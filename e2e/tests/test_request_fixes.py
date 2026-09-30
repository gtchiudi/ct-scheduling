"""
E2E regression tests for the fixes in b09077f:

  - BUG-1: /api/request/ needs a login except create and the anonymous
    /api/request/slots/ endpoint (warehouse, date_time, appointment_length only).
    The public request form must still grey out booked slots and pick the first
    available one using /slots/.
  - BUG-2: "Remove from Calendar" on a completed appointment emails nobody and is
    audited as `removed` ("Removed from calendar"), not `declined`.
  - BUG-5: datetimes are sent with their UTC offset, so a browser outside Eastern
    time stores exactly the time that was picked (calendar create, approve).
    The calendar's range query sends real UTC instants; events at the edges of
    the visible week still show.

Browsers in other timezones use their own context (timezone_id). The E2E
warehouse ("E2E Test Warehouse") is in America/New_York, and the date pickers
run in the warehouse's timezone.
"""

import uuid
from datetime import date, datetime, time, timedelta
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

import pytest
import requests as req_lib
from playwright.sync_api import expect

from e2e.conftest import DISPATCH_PASSWORD, DISPATCH_USERNAME, _get_jwt_tokens, _inject_auth
from e2e.pages.audit_log_page import AuditLogPage
from e2e.pages.calendar_page import CalendarPage
from e2e.pages.pending_requests_page import PendingRequestsPage
from e2e.pages.request_form_page import RequestFormPage
from e2e.tests.test_audit_trail import _auth, _edit_via_api, _token
from e2e.tests.test_calendar_workflow import _e2e_warehouse_id, _next_visible_date, _soft_delete
from e2e_config import BASE_URL

NY = ZoneInfo("America/New_York")
WAREHOUSE_ADDRESS = "123 Test St, Cleveland, OH 44101"
SLOT_FIELDS = {"warehouse", "date_time", "appointment_length"}
BROWSER_TIMEZONES = ["America/New_York", "America/Chicago"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ref(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


def _parse(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _create(access, wh_id, company, ref, when, approved=True, **extra):
    """POST a request whose date_time is the aware datetime `when`."""
    body = {
        "company_name": company, "customer_name": "E2E Customer", "email": "fixes@e2e.test",
        "warehouse": wh_id, "ref_number": ref, "load_type": "Full", "delivery": False,
        "date_time": when.isoformat(), "approved": approved, "active": True, **extra,
    }
    headers = _auth(access) if access else {}
    resp = req_lib.post(f"{BASE_URL}/api/request/", json=body, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _find_by_ref(access, ref):
    resp = req_lib.get(f"{BASE_URL}/api/request/", params={"search": ref},
                       headers=_auth(access), timeout=10)
    resp.raise_for_status()
    rows = [r for r in resp.json() if ref in r["ref_number"]]
    assert len(rows) == 1, f"expected one request with ref {ref}, got {len(rows)}"
    return rows[0]


def _timeline(access, appt_id):
    resp = req_lib.get(f"{BASE_URL}/api/audit/timeline/", params={"appointment": appt_id},
                       headers=_auth(access), timeout=10)
    resp.raise_for_status()
    return resp.json()


def _next_work_day_ny():
    """Mirror of Form.jsx nextWorkDay() evaluated in the warehouse timezone."""
    today = datetime.now(NY).date()
    step = {4: 3, 5: 2}.get(today.weekday(), 1)   # Fri -> Mon, Sat -> Mon
    return today + timedelta(days=step)


def _tz_page(browser_instance, timezone_id, groups=("Dispatch",)):
    """New context in `timezone_id` with the Dispatch user injected."""
    context = browser_instance.new_context(base_url=BASE_URL, timezone_id=timezone_id,
                                           accept_downloads=True)
    page = context.new_page()
    access, refresh = _get_jwt_tokens(DISPATCH_USERNAME, DISPATCH_PASSWORD)
    _inject_auth(page, access, refresh, list(groups), "D")
    return context, page


@pytest.fixture
def dispatch_access():
    return _token(DISPATCH_USERNAME, DISPATCH_PASSWORD)


@pytest.fixture
def cleanup(dispatch_access):
    """Collects request ids to soft-delete after the test."""
    ids = []
    yield ids
    for request_id in ids:
        _soft_delete(dispatch_access, request_id)


# ---------------------------------------------------------------------------
# BUG-1: anonymous API lock-down + public form still works
# ---------------------------------------------------------------------------

@pytest.mark.e2e
@pytest.mark.parametrize("method,suffix", [
    ("get", ""), ("get", "{id}/"), ("put", "{id}/"), ("patch", "{id}/"),
    ("delete", "{id}/"), ("post", "{id}/remove/"),
])
def test_anonymous_request_api_is_rejected(dispatch_access, cleanup, method, suffix):
    wh_id = _e2e_warehouse_id(dispatch_access)
    appt = _create(dispatch_access, wh_id, "E2E Anon Lock Co", _ref("ANON"),
                   datetime.combine(_next_visible_date(), time(9, 0), NY))
    cleanup.append(appt["id"])
    url = f"{BASE_URL}/api/request/{suffix.format(id=appt['id'])}"
    resp = getattr(req_lib, method)(url, json={"active": False}, timeout=10)
    assert resp.status_code in (401, 403), f"{method.upper()} {url}: {resp.status_code}"
    # Still there and untouched
    after = req_lib.get(f"{BASE_URL}/api/request/{appt['id']}/", headers=_auth(dispatch_access),
                        timeout=10)
    assert after.status_code == 200 and after.json()["active"] is True


@pytest.mark.e2e
def test_anonymous_slots_endpoint_exposes_only_times(dispatch_access, cleanup):
    wh_id = _e2e_warehouse_id(dispatch_access)
    day = _next_visible_date()
    appt = _create(dispatch_access, wh_id, "E2E Slots Co", _ref("SLOT"),
                   datetime.combine(day, time(9, 45), NY))
    cleanup.append(appt["id"])
    start = datetime.combine(day, time.min, NY).isoformat()
    end = datetime.combine(day, time.max, NY).isoformat()

    resp = req_lib.get(f"{BASE_URL}/api/request/slots/",
                       params={"start_date": start, "end_date": end, "warehouse": wh_id},
                       timeout=10)
    assert resp.status_code == 200
    rows = resp.json()
    assert rows, "expected at least the appointment just created"
    for row in rows:
        assert set(row) == SLOT_FIELDS, f"slots leaked extra fields: {sorted(row)}"
        assert row["warehouse"] == wh_id
    assert any(_parse(r["date_time"]) == _parse(appt["date_time"]) for r in rows)

    missing = req_lib.get(f"{BASE_URL}/api/request/slots/", timeout=10)
    assert missing.status_code == 400


@pytest.fixture
def booked_morning(dispatch_access, cleanup):
    """Fill 08:00 and 08:15 on the form's first candidate day; return (day, expected slot)."""
    wh = next(w for w in req_lib.get(f"{BASE_URL}/api/warehouse/", headers=_auth(dispatch_access),
                                     timeout=10).json()
              if w["name"] == "E2E Test Warehouse")
    per_slot = wh.get("appointments_per_slot") or 1
    day = _next_work_day_ny()
    taken = req_lib.get(f"{BASE_URL}/api/request/slots/", params={
        "start_date": datetime.combine(day, time.min, NY).isoformat(),
        "end_date": datetime.combine(day, time.max, NY).isoformat(),
        "warehouse": wh["id"],
    }, timeout=10).json()
    counts = {}
    for row in taken:
        key = _parse(row["date_time"]).astimezone(NY).strftime("%H:%M")
        counts[key] = counts.get(key, 0) + 1
    booked = []
    for hhmm in ("08:00", "08:15"):
        while counts.get(hhmm, 0) < per_slot:
            hour, minute = map(int, hhmm.split(":"))
            appt = _create(dispatch_access, wh["id"], "E2E Booked Slot Co", _ref("BOOK"),
                           datetime.combine(day, time(hour, minute), NY))
            cleanup.append(appt["id"])
            counts[hhmm] = counts.get(hhmm, 0) + 1
        booked.append(hhmm)
    slot = datetime.combine(day, time(8, 0), NY)
    while counts.get(slot.strftime("%H:%M"), 0) >= per_slot:
        slot += timedelta(minutes=15)
    return day, slot, booked


@pytest.mark.e2e
@pytest.mark.parametrize("timezone_id", BROWSER_TIMEZONES)
def test_public_form_first_available_and_booked_slots(browser_instance, booked_morning,
                                                      dispatch_access, cleanup, timezone_id):
    """Anonymous form: picking the warehouse jumps to the first open slot, booked
    minutes are not offered, and the submitted time is stored exactly."""
    day, expected, booked = booked_morning
    ref = _ref("PUBFA")
    context = browser_instance.new_context(base_url=BASE_URL, timezone_id=timezone_id)
    try:
        page = context.new_page()
        form = RequestFormPage(page)
        form.navigate_to()
        form.fill_company_name("E2E First Available Co")
        form.fill_email("first-available@e2e.test")
        form.fill_phone("5551234567")
        form.fill_ref_number(ref)
        form.select_warehouse(WAREHOUSE_ADDRESS)

        picker = page.get_by_label("Select Appointment Date and Time")
        expect(picker).to_have_value(expected.strftime("%m/%d/%Y %H:%M"), timeout=15000)

        # Booked minutes in the 08 hour are not offered (skipDisabled hides them).
        page.locator("button[aria-label^='Choose date']").first.click()
        hours = page.get_by_role("listbox", name="Select hours")
        minutes = page.get_by_role("listbox", name="Select minutes")
        expect(minutes).to_be_visible(timeout=5000)
        if expected.hour == 8:
            offered = [m.strip() for m in minutes.get_by_role("option").all_inner_texts()]
            for hhmm in booked:
                assert hhmm[3:] not in offered, f"booked {hhmm} still offered: {offered}"
            assert expected.strftime("%M") in offered
        else:
            assert "08" not in [h.strip() for h in hours.get_by_role("option").all_inner_texts()]
        page.keyboard.press("Escape")

        form.select_load_type("Full")
        form.select_delivery(delivery=False)
        form.submit()
        form.assert_success_visible()
    finally:
        context.close()

    stored = _find_by_ref(dispatch_access, ref)
    cleanup.append(stored["id"])
    assert _parse(stored["date_time"]) == expected


# ---------------------------------------------------------------------------
# BUG-2: Remove from Calendar
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_remove_from_calendar_completed_appointment(dispatch_page, dispatch_access, cleanup):
    wh_id = _e2e_warehouse_id(dispatch_access)
    ref = _ref("RMV")
    appt = _create(dispatch_access, wh_id, "E2E Remove Co", ref,
                   datetime.combine(_next_visible_date(), time(12, 0), NY))
    cleanup.append(appt["id"])
    now = datetime.now(NY).replace(microsecond=0)
    _edit_via_api(dispatch_access, appt["id"], check_in_time=(now - timedelta(hours=1)).isoformat())
    _edit_via_api(dispatch_access, appt["id"], dock_number=7,
                  docked_time=(now - timedelta(minutes=30)).isoformat())
    _edit_via_api(dispatch_access, appt["id"], completed_time=now.isoformat())

    calendar = CalendarPage(dispatch_page)
    calendar.force_navigate_to()
    calendar.wait_for_event(ref)
    calendar.click_event_by_ref(ref)
    dispatch_page.get_by_role("button", name="Remove from Calendar").click()
    dispatch_page.wait_for_selector("[role=dialog]", state="hidden", timeout=10000)
    expect(dispatch_page.locator(".rs__event__item").filter(has_text=ref)).to_have_count(
        0, timeout=10000)

    timeline = _timeline(dispatch_access, appt["id"])
    actions = [i["action"] for i in timeline if i["type"] == "event"]
    assert actions[0] == "removed", actions
    assert "declined" not in actions
    kinds = [i["kind"] for i in timeline if i["type"] == "notification"]
    assert "decline" not in kinds, kinds
    notes = req_lib.get(f"{BASE_URL}/api/audit/notifications/",
                        params={"appointment": appt["id"], "kind": "decline"},
                        headers=_auth(dispatch_access), timeout=10).json()
    assert notes["count"] == 0

    # Audit Log: filterable as "Removed from calendar"
    audit = AuditLogPage(dispatch_page)
    audit.navigate_to()
    audit.wait_for_events_table()
    audit.filter_actions("Removed from calendar")
    audit.wait_for_rows_to_match("Action", {"Removed from calendar"})
    row = audit.rows().filter(has_text=ref)
    expect(row).to_have_count(1, timeout=10000)
    expect(row).to_contain_text(DISPATCH_USERNAME)


# ---------------------------------------------------------------------------
# BUG-5: non-Eastern browsers store the picked time
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_central_browser_calendar_create_stores_picked_time(browser_instance, dispatch_access,
                                                            cleanup):
    ref = _ref("CTCRT")
    context, page = _tz_page(browser_instance, "America/Chicago")
    try:
        calendar = CalendarPage(page)
        calendar.wait_for_scheduler()
        calendar.click_empty_slot()
        dlg = page.get_by_role("dialog").filter(has_text="Create Appointment")
        dlg.get_by_label("Carrier Name").fill("E2E Central Create Co")
        dlg.get_by_label("Warehouse").click()
        page.locator("[role=listbox]").get_by_text("E2E Test Warehouse", exact=True).click()
        dlg.get_by_label("Load Type").click()
        page.locator("[role=listbox]").get_by_text("Full", exact=True).click()
        dlg.get_by_label("Select Pickup or Delivery").click()
        page.locator("[role=listbox]").get_by_text("Pickup", exact=True).click()
        customer = dlg.get_by_label("Customer Name")
        customer.click()
        customer.fill("E2E Customer")
        page.locator("[role=option]").filter(has_text="E2E Customer").first.click()
        dlg.get_by_label("Reference / PO Number").fill(ref)

        # The picker shows the warehouse's (New York) wall time.
        picked = dlg.get_by_label("Select Appointment Date and Time").input_value()
        dlg.get_by_role("button", name="Submit").click()
        page.wait_for_selector("[role=dialog]", state="hidden", timeout=10000)
    finally:
        context.close()

    stored = _find_by_ref(dispatch_access, ref)
    cleanup.append(stored["id"])
    expected = datetime.strptime(picked, "%m/%d/%Y %H:%M").replace(tzinfo=NY)
    assert _parse(stored["date_time"]) == expected, (picked, stored["date_time"])


@pytest.mark.e2e
def test_central_browser_approve_keeps_requested_time(browser_instance, dispatch_access, cleanup):
    wh_id = _e2e_warehouse_id(dispatch_access)
    company = f"E2E Central Approve {uuid.uuid4().hex[:4].upper()}"
    requested = datetime.combine(_next_work_day_ny() + timedelta(days=7), time(10, 30), NY)
    pending = _create(None, wh_id, company, _ref("CTAPR"), requested, approved=False)
    cleanup.append(pending["id"])

    context, page = _tz_page(browser_instance, "America/Chicago")
    try:
        pr = PendingRequestsPage(page)
        pr.navigate_to()
        pr.wait_for_table()
        pr.click_request_by_company(company)
        pr.approve_current_request()
    finally:
        context.close()

    after = req_lib.get(f"{BASE_URL}/api/request/{pending['id']}/",
                        headers=_auth(dispatch_access), timeout=10).json()
    assert after["approved"] is True
    assert _parse(after["date_time"]) == requested, after["date_time"]
    edits = [i for i in _timeline(dispatch_access, pending["id"])
             if i["type"] == "event" and i["action"] == "edited"]
    assert all("date_time" not in e["changes"] for e in edits), edits


@pytest.mark.e2e
@pytest.mark.parametrize("timezone_id", BROWSER_TIMEZONES)
def test_calendar_shows_events_at_week_edges(browser_instance, dispatch_access, cleanup,
                                            timezone_id):
    """Monday-morning and Friday-evening events of the visible week render, and the
    range query sends real UTC instants for local midnight."""
    wh_id = _e2e_warehouse_id(dispatch_access)
    visible = _next_visible_date()
    monday = visible - timedelta(days=visible.weekday())
    friday = monday + timedelta(days=4)
    # Inside the scheduler's 06:00-18:00 grid in both New York and Chicago.
    edges = {
        _ref("WKMON"): datetime.combine(monday, time(7, 0), NY),
        _ref("WKFRI"): datetime.combine(friday, time(17, 30), NY),
    }
    for ref, when in edges.items():
        cleanup.append(_create(dispatch_access, wh_id, "E2E Week Edge Co", ref, when)["id"])

    context = browser_instance.new_context(base_url=BASE_URL, timezone_id=timezone_id)
    try:
        page = context.new_page()
        range_queries = []
        page.on("request", lambda r: range_queries.append(r.url)
                if "/api/request" in r.url and "start_date" in r.url else None)
        access, refresh = _get_jwt_tokens(DISPATCH_USERNAME, DISPATCH_PASSWORD)
        _inject_auth(page, access, refresh, ["Dispatch"], "D")
        calendar = CalendarPage(page)
        calendar.wait_for_scheduler()
        for ref in edges:
            calendar.wait_for_event(ref)

        assert range_queries, "calendar never queried /api/request with a date range"
        params = parse_qs(urlparse(range_queries[-1]).query)
        start = _parse(params["start_date"][0])
        assert start.utcoffset() == timedelta(0)
        local_start = start.astimezone(ZoneInfo(timezone_id))
        assert (local_start.day, local_start.hour, local_start.minute) == (1, 0, 0), \
            f"range start {params['start_date'][0]} is not local midnight on the 1st"
    finally:
        context.close()

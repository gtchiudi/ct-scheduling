"""
E2E tests for the Appointment Audit Trail.

  - Activity history in the appointment window reflects an edit made in the UI
  - "Audit Log" nav link and page load for Dispatch
  - Filter appointment activity by action and person
  - Notifications tab lists emails sent for an appointment
  - Export CSV downloads the rows matching the current filters
  - Search finds an appointment's activity and notifications by reference number
  - Dock users: no nav link, redirected away from /AuditLog, 403 from the API

Requires the app to be running with the audit trail migrations applied. Emails
are recorded as NotificationLog rows; with e2e/e2e_django_settings.py they go to
the console backend and are recorded as "sent".
"""

import uuid

import pytest
import requests as req_lib
from playwright.sync_api import expect

from e2e.conftest import DISPATCH_PASSWORD, DISPATCH_USERNAME, DOCK_PASSWORD, DOCK_USERNAME
from e2e.pages.audit_log_page import EVENTS_TABLE, NOTIFICATIONS_TABLE, AuditLogPage
from e2e.pages.calendar_page import CalendarPage
from e2e.tests.test_calendar_workflow import (
    _create_approved_request,
    _e2e_warehouse_id,
    _soft_delete,
)
from e2e_config import BASE_URL

EVENT_CSV_COLUMNS = [
    "occurred_at", "action", "actor_name", "appointment_ref", "appointment_company",
    "warehouse_name", "changes", "appointment",
]
AUDIT_ENDPOINTS = [
    "/api/audit/events/",
    "/api/audit/notifications/",
    "/api/audit/actors/",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _token(username, password):
    resp = req_lib.post(
        f"{BASE_URL}/token/", json={"username": username, "password": password}, timeout=10
    )
    resp.raise_for_status()
    return resp.json()["access"]


def _auth(access):
    return {"Authorization": f"Bearer {access}"}


def _edit_via_api(access, request_id, **overrides):
    """GET the appointment and PUT it back with overrides (as the UI does)."""
    got = req_lib.get(f"{BASE_URL}/api/request/{request_id}/", headers=_auth(access), timeout=10)
    got.raise_for_status()
    body = {
        k: v for k, v in got.json().items()
        if k not in {"id", "customer", "created_by", "created_by_name", "created_at", "updated_at"}
    }
    customer = got.json().get("customer")
    body["customer_id"] = customer["id"] if customer else None
    body.update(overrides)
    resp = req_lib.put(
        f"{BASE_URL}/api/request/{request_id}/", json=body, headers=_auth(access), timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def _unique_ref(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def dispatch_access():
    return _token(DISPATCH_USERNAME, DISPATCH_PASSWORD)


@pytest.fixture
def audited_appointment(dispatch_access):
    """An approved appointment created (and then edited) by the Dispatch user via the API.

    Produces: a `created` event and an `edited` event (note_section) with actor
    e2e_dispatch, plus a `calendar_event` email notification.
    """
    wh_id = _e2e_warehouse_id(dispatch_access)
    ref = _unique_ref("AUD")
    data = _create_approved_request(dispatch_access, wh_id, "E2E Audit Co", ref, hour=13)
    _edit_via_api(dispatch_access, data["id"], note_section=f"audit note {ref}")
    data["ref"] = ref
    yield data
    _soft_delete(dispatch_access, data["id"])


@pytest.fixture
def ui_edit_appointment(dispatch_access):
    """Approved appointment the test edits through the calendar UI."""
    wh_id = _e2e_warehouse_id(dispatch_access)
    ref = _unique_ref("AUDUI")
    data = _create_approved_request(dispatch_access, wh_id, "E2E History Co", ref, hour=14)
    data["ref"] = ref
    yield data
    _soft_delete(dispatch_access, data["id"])


# ---------------------------------------------------------------------------
# Activity history (appointment window)
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_activity_history_shows_ui_edit(dispatch_page, ui_edit_appointment):
    """A Dispatch user edits an appointment; the change appears in Activity history."""
    ref = ui_edit_appointment["ref"]
    calendar = CalendarPage(dispatch_page)
    calendar.force_navigate_to()
    calendar.wait_for_event(ref)

    # Before editing: the history already has the "Created" entry.
    calendar.click_event_by_ref(ref)
    history = dispatch_page.get_by_test_id("activity-history")
    history.scroll_into_view_if_needed()
    expect(history.get_by_text("Activity history", exact=True)).to_be_visible(timeout=10000)
    expect(history.get_by_test_id("activity-item").filter(has_text="Created")).to_have_count(
        1, timeout=10000
    )

    # Edit the carrier name and save.
    dispatch_page.get_by_role("button", name="Edit Appointment").click()
    dispatch_page.get_by_label("Carrier Name").fill("E2E History Co Renamed")
    dispatch_page.get_by_role("button", name="Save Changes").click()
    dispatch_page.wait_for_selector("[role=dialog]", state="hidden", timeout=10000)

    # Re-open: newest entry is the edit, with before -> after.
    calendar.wait_for_event(ref)
    calendar.click_event_by_ref(ref)
    history = dispatch_page.get_by_test_id("activity-history")
    history.scroll_into_view_if_needed()
    edited = history.get_by_test_id("activity-item").filter(has_text="Edited")
    expect(edited).to_have_count(1, timeout=10000)
    expect(edited).to_contain_text("E2E History Co")
    expect(edited).to_contain_text("E2E History Co Renamed")
    expect(edited).to_contain_text(DISPATCH_USERNAME)
    # Newest first
    expect(history.get_by_test_id("activity-item").first).to_contain_text("Edited")


@pytest.mark.e2e
def test_activity_history_hidden_for_dock(dock_page, audited_appointment):
    """Dock users see the appointment window without Activity history."""
    calendar = CalendarPage(dock_page)
    calendar.force_navigate_to()
    calendar.wait_for_event(audited_appointment["ref"])
    calendar.click_event_by_ref(audited_appointment["ref"])
    dock_page.wait_for_load_state("networkidle")
    expect(dock_page.get_by_test_id("activity-history")).to_have_count(0)


# ---------------------------------------------------------------------------
# Audit Log page
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_audit_log_nav_link_and_page_load(dispatch_page):
    """Dispatch sees the Audit Log link; it opens /AuditLog with both tabs."""
    audit = AuditLogPage(dispatch_page)
    expect(audit.nav_link()).to_be_visible(timeout=10000)
    audit.navigate_via_nav_link()
    expect(dispatch_page.get_by_role("tab", name="Appointment activity")).to_be_visible()
    expect(dispatch_page.get_by_role("tab", name="Notifications")).to_be_visible()
    audit.wait_for_events_table()
    expect(dispatch_page.locator(EVENTS_TABLE)).to_be_visible()


@pytest.mark.e2e
def test_filter_events_by_action_and_person(dispatch_page, audited_appointment):
    """Filtering by Action=Edited and Person=e2e_dispatch shows only matching rows."""
    audit = AuditLogPage(dispatch_page)
    audit.navigate_via_nav_link()
    audit.wait_for_events_table()

    audit.filter_actions("Edited")
    audit.wait_for_rows_to_match("Action", {"Edited"})

    audit.filter_person(DISPATCH_USERNAME)
    audit.wait_for_rows_to_match("Person", {DISPATCH_USERNAME})
    assert set(audit.column_values("Action")) == {"Edited"}

    # The fixture's edit is the newest matching row, so it is on page 1.
    expect(audit.rows().filter(has_text=audited_appointment["ref"])).to_have_count(
        1, timeout=10000
    )
    expect(audit.rows().filter(has_text=audited_appointment["ref"])).to_contain_text("Notes")


@pytest.mark.e2e
def test_notifications_tab(dispatch_page, audited_appointment):
    """The Notifications tab lists the email sent when the appointment was created."""
    audit = AuditLogPage(dispatch_page)
    audit.navigate_via_nav_link()
    audit.open_notifications_tab()

    audit.filter_notification_types("Calendar event")
    audit.wait_for_rows_to_match("Type", {"Calendar event"}, table_selector=NOTIFICATIONS_TABLE)
    row = audit.rows(NOTIFICATIONS_TABLE).filter(has_text=audited_appointment["ref"])
    expect(row).to_have_count(1, timeout=10000)
    expect(row).to_contain_text("Email")
    expect(row).to_contain_text("E2E Audit Co")


@pytest.mark.e2e
def test_export_csv_matches_filters(dispatch_page, audited_appointment, dispatch_access):
    """Export CSV downloads exactly the rows matching the current filters."""
    audit = AuditLogPage(dispatch_page)
    audit.navigate_via_nav_link()
    audit.wait_for_events_table()
    audit.filter_actions("Edited")
    audit.wait_for_rows_to_match("Action", {"Edited"})

    filename, header, rows = audit.export_csv()
    assert filename.endswith(".csv")
    assert header == EVENT_CSV_COLUMNS
    col = {name: i for i, name in enumerate(header)}
    assert rows, "CSV export was empty"
    assert {r[col["action"]] for r in rows} == {"edited"}
    assert any(audited_appointment["ref"] in r[col["appointment_ref"]] for r in rows)

    # Same filters through the API: the CSV holds the full filtered set (not one page).
    api = req_lib.get(
        f"{BASE_URL}/api/audit/events/",
        params={"action": "edited", "page_size": 1},
        headers=_auth(dispatch_access),
        timeout=10,
    )
    api.raise_for_status()
    assert len(rows) == api.json()["count"]


@pytest.mark.e2e
def test_search_by_reference_on_both_tabs(dispatch_page, audited_appointment, dispatch_access):
    """Searching a reference number narrows both tabs to that appointment, and the
    CSV export carries the search."""
    ref = audited_appointment["ref"]
    audit = AuditLogPage(dispatch_page)
    audit.navigate_via_nav_link()
    audit.wait_for_events_table()

    audit.search(ref.lower())  # case-insensitive
    audit.wait_for_rows_to_match("Action", {"Created", "Edited"})
    expect(audit.rows()).to_have_count(2, timeout=10000)
    for row in audit.rows().all():
        expect(row).to_contain_text(ref)

    _, header, rows = audit.export_csv()
    col = {name: i for i, name in enumerate(header)}
    assert sorted(r[col["action"]] for r in rows) == ["created", "edited"]
    assert all(ref in r[col["appointment_ref"]] for r in rows)

    audit.clear_search()
    expect(audit.rows()).not_to_have_count(2, timeout=10000)

    audit.open_notifications_tab()
    audit.search(ref)
    row = audit.rows(NOTIFICATIONS_TABLE)
    expect(row).to_have_count(1, timeout=10000)
    expect(row).to_contain_text("Calendar event")

    # Search matches recipient too (the internal calendar-event mailbox).
    api = req_lib.get(
        f"{BASE_URL}/api/audit/notifications/",
        params={"search": ref, "page_size": 1},
        headers=_auth(dispatch_access),
        timeout=10,
    ).json()
    recipient = api["results"][0]["recipient"]
    audit.search(f"{ref} {recipient.upper()}")  # words ANDed across fields
    expect(audit.rows(NOTIFICATIONS_TABLE)).to_have_count(1, timeout=10000)


# ---------------------------------------------------------------------------
# Dock user restrictions
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_dock_has_no_audit_log_link(dock_page):
    expect(dock_page.get_by_text("Pending Requests").first).not_to_be_visible()
    assert not AuditLogPage(dock_page).nav_link().is_visible(), \
        "Audit Log link should not be visible for Dock users"


@pytest.mark.e2e
def test_dock_redirected_from_audit_log(dock_page):
    dock_page.goto(f"{BASE_URL}/AuditLog")
    dock_page.wait_for_url("**/Calendar", timeout=10000)
    assert "/AuditLog" not in dock_page.url
    expect(dock_page.locator(EVENTS_TABLE)).to_have_count(0)


@pytest.mark.e2e
@pytest.mark.parametrize("path", AUDIT_ENDPOINTS + ["/api/audit/timeline/?appointment=x"])
def test_dock_gets_403_from_audit_api(path):
    access = _token(DOCK_USERNAME, DOCK_PASSWORD)
    resp = req_lib.get(f"{BASE_URL}{path}", headers=_auth(access), timeout=10)
    assert resp.status_code == 403, f"{path}: {resp.status_code}"


@pytest.mark.e2e
@pytest.mark.parametrize("path", AUDIT_ENDPOINTS)
def test_anonymous_gets_401_from_audit_api(path):
    resp = req_lib.get(f"{BASE_URL}{path}", timeout=10)
    assert resp.status_code == 401, f"{path}: {resp.status_code}"


# ---------------------------------------------------------------------------
# Regression: BUG-5 (fixed in b09077f). The form used to send date_time as a naive
# browser-local string that Django read as America/New_York, so an unchanged
# "Save Changes" from a non-Eastern browser moved the appointment.
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_bug_noop_save_from_central_time_browser_keeps_date(browser_instance, ui_edit_appointment,
                                                           dispatch_access):
    from e2e.conftest import _get_jwt_tokens, _inject_auth

    ref = ui_edit_appointment["ref"]
    context = browser_instance.new_context(base_url=BASE_URL, timezone_id="America/Chicago")
    try:
        page = context.new_page()
        access, refresh = _get_jwt_tokens(DISPATCH_USERNAME, DISPATCH_PASSWORD)
        _inject_auth(page, access, refresh, ["Dispatch"], "D")
        calendar = CalendarPage(page)
        calendar.wait_for_scheduler()
        calendar.wait_for_event(ref)
        calendar.click_event_by_ref(ref)
        page.get_by_role("button", name="Edit Appointment").click()
        page.get_by_role("button", name="Save Changes").click()
        page.wait_for_selector("[role=dialog]", state="hidden", timeout=10000)
    finally:
        context.close()

    after = req_lib.get(f"{BASE_URL}/api/request/{ui_edit_appointment['id']}/",
                        headers=_auth(dispatch_access), timeout=10).json()
    assert after["date_time"] == ui_edit_appointment["date_time"]
    timeline = req_lib.get(f"{BASE_URL}/api/audit/timeline/",
                           params={"appointment": ui_edit_appointment["id"]},
                           headers=_auth(dispatch_access), timeout=10).json()
    assert [i["action"] for i in timeline if i["type"] == "event"] == ["created"]

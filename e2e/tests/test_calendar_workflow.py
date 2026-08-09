"""
E2E tests for Calendar appointment workflows (Dispatch user):

  - Check-In → Send to Dock → Complete
  - Edit an existing appointment
  - Create from the calendar with multiple reference numbers
"""

import pytest
import requests as req_lib
from datetime import date, timedelta
from playwright.sync_api import expect

from e2e.pages.calendar_page import CalendarPage
from e2e_config import BASE_URL
from e2e.conftest import DISPATCH_USERNAME, DISPATCH_PASSWORD


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _dispatch_token():
    resp = req_lib.post(
        f"{BASE_URL}/token/",
        json={"username": DISPATCH_USERNAME, "password": DISPATCH_PASSWORD},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access"]


def _e2e_warehouse_id(access):
    resp = req_lib.get(
        f"{BASE_URL}/api/warehouse/",
        headers={"Authorization": f"Bearer {access}"},
        timeout=10,
    )
    resp.raise_for_status()
    for w in resp.json():
        if w["name"] == "E2E Test Warehouse":
            return w["id"]
    return resp.json()[0]["id"]


def _next_visible_date():
    """Return a date that falls within the scheduler's current week view.

    <Scheduler week={{ weekDays: [2,3,4,5,6], weekStartOn: 6 }}> — weekDays
    values are *offsets* from weekStartOn (Saturday), not absolute
    day-of-week numbers, so this combination renders Mon-Fri (Sat+2..Sat+6),
    not Tue-Sat. Weekends (Sat/Sun) aren't shown; advance to the following
    Monday.
    """
    today = date.today()
    weekday = today.weekday()   # 0=Mon, ..., 5=Sat, 6=Sun
    if weekday == 5:            # Saturday → +2 days → Monday
        return today + timedelta(days=2)
    if weekday == 6:            # Sunday   → +1 day  → Monday
        return today + timedelta(days=1)
    return today                # Already Mon-Fri, use today


def _create_approved_request(access, warehouse_id, company_name, ref_number, hour=10):
    """POST an approved request on the next scheduler-visible date and return the JSON."""
    target = _next_visible_date()
    resp = req_lib.post(
        f"{BASE_URL}/api/request/",
        json={
            "company_name": company_name,
            "customer_name": "E2E Customer",
            "email": "workflow@e2e.test",
            "warehouse": warehouse_id,
            "ref_number": ref_number,
            "load_type": "Full",
            "delivery": True,
            "date_time": f"{target.isoformat()} {hour:02d}:00:00",
            "approved": True,
            "active": True,
        },
        headers={"Authorization": f"Bearer {access}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _soft_delete(access, request_id):
    req_lib.delete(
        f"{BASE_URL}/api/request/{request_id}/",
        headers={"Authorization": f"Bearer {access}"},
        timeout=10,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def checkin_appointment():
    """Approved appointment used by the check-in → dock → complete test."""
    access = _dispatch_token()
    wh_id = _e2e_warehouse_id(access)
    data = _create_approved_request(
        access, wh_id, "E2E CheckIn Co", "WF-CHECKIN-001", hour=10
    )
    yield data
    _soft_delete(access, data["id"])


@pytest.fixture
def edit_appointment():
    """Approved appointment used by the edit test."""
    access = _dispatch_token()
    wh_id = _e2e_warehouse_id(access)
    data = _create_approved_request(
        access, wh_id, "E2E Edit Co", "WF-EDIT-001", hour=11
    )
    yield data
    _soft_delete(access, data["id"])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_checkin_dock_complete_workflow(dispatch_page, checkin_appointment):
    """An approved appointment progresses through Check-In → Dock → Complete.

    Each PATCH (Check-In, Dock, Complete) closes the dialog via closeModal().
    The test re-opens the event between stages to perform the next action.
    The SMS-consent warning always fires when no driver phone is on file;
    clicking OK on the Alert triggers the dock PATCH via onAcknowledge().
    """
    calendar = CalendarPage(dispatch_page)
    # Hard-reload so the fixture's freshly created event is visible.
    calendar.force_navigate_to()
    calendar.wait_for_event("WF-CHECKIN-001")

    # ── Stage 1: Check-In ────────────────────────────────────────────────────
    calendar.click_event_by_ref("WF-CHECKIN-001")
    dispatch_page.get_by_role("button", name="Check-In").click()
    # Successful PATCH closes the dialog immediately
    dispatch_page.wait_for_selector("[role='dialog']", state="hidden", timeout=10000)
    dispatch_page.wait_for_load_state("networkidle")

    # ── Stage 2: Assign dock and send ────────────────────────────────────────
    # Re-open the event — it now shows the Dock Number field + Send To Dock button
    calendar.wait_for_event("WF-CHECKIN-001")
    calendar.click_event_by_ref("WF-CHECKIN-001")
    dispatch_page.get_by_label("Dock Number").fill("5")
    dispatch_page.get_by_role("button", name="Send To Dock").click()
    # No driver phone/consent → SMS warning Alert always fires; OK triggers the PATCH
    dispatch_page.get_by_role("button", name="OK").click()
    dispatch_page.wait_for_selector("[role='dialog']", state="hidden", timeout=10000)
    dispatch_page.wait_for_load_state("networkidle")

    # ── Stage 3: Complete ────────────────────────────────────────────────────
    calendar.wait_for_event("WF-CHECKIN-001")
    calendar.click_event_by_ref("WF-CHECKIN-001")
    # "Complete" is disabled until the Paperwork Scanned acknowledgement is checked
    dispatch_page.get_by_label("Paperwork Scanned").check()
    dispatch_page.get_by_role("button", name="Complete").click()
    dispatch_page.wait_for_selector("[role='dialog']", state="hidden", timeout=10000)
    dispatch_page.wait_for_load_state("networkidle")

    # ── Verify completed state ────────────────────────────────────────────────
    # Re-open one final time to confirm "Remove from Calendar" is now the active button
    calendar.wait_for_event("WF-CHECKIN-001")
    calendar.click_event_by_ref("WF-CHECKIN-001")
    expect(
        dispatch_page.get_by_role("button", name="Remove from Calendar")
    ).to_be_visible(timeout=5000)


@pytest.mark.e2e
def test_edit_appointment(dispatch_page, edit_appointment):
    """A Dispatch user can edit an approved appointment and save the changes."""
    calendar = CalendarPage(dispatch_page)
    calendar.force_navigate_to()
    calendar.wait_for_event("WF-EDIT-001")

    # Open the event dialog
    calendar.click_event_by_ref("WF-EDIT-001")

    # Enter edit mode — only available before check-in for Admin/Dispatch users
    dispatch_page.get_by_role("button", name="Edit Appointment").click()
    expect(
        dispatch_page.get_by_role("button", name="Save Changes")
    ).to_be_visible(timeout=5000)

    # Edit the Carrier Name field
    carrier_field = dispatch_page.get_by_label("Carrier Name")
    carrier_field.fill("E2E Edit Co Updated")

    # Save
    dispatch_page.get_by_role("button", name="Save Changes").click()
    # Dialog closes on a successful PATCH
    dispatch_page.wait_for_selector("[role=dialog]", state="hidden", timeout=10000)

    # Re-open the event to verify the change persisted
    calendar.click_event_by_ref("WF-EDIT-001")
    expect(
        dispatch_page.get_by_label("Carrier Name")
    ).to_have_value("E2E Edit Co Updated", timeout=5000)


@pytest.mark.e2e
def test_create_appointment_with_multiple_ref_numbers(dispatch_page):
    """An appointment created from the calendar can carry multiple PO/ref numbers.

    The 'Add New' button appends a second reference field.  Both values are stored
    semicolon-separated and the first is used as the calendar event title.
    """
    calendar = CalendarPage(dispatch_page)
    calendar.force_navigate_to()

    # Click an empty time slot — triggers the scheduler's CustomEditor (create form)
    # click_empty_slot() already waits for "Create Appointment" to be visible
    calendar.click_empty_slot()

    # Scope all form interactions to the Create Appointment dialog to avoid strict-mode
    # violations from warehouse checkboxes in the sidebar also matching "Warehouse".
    dlg = dispatch_page.get_by_role("dialog").filter(has_text="Create Appointment")

    # Fill required fields
    dlg.get_by_label("Carrier Name").fill("E2E Calendar Create Co")

    dlg.get_by_label("Warehouse").click()
    dispatch_page.wait_for_selector("[role=listbox]", timeout=5000)
    dispatch_page.locator("[role=listbox]").get_by_text(
        "E2E Test Warehouse", exact=True
    ).click()

    dlg.get_by_label("Load Type").click()
    dispatch_page.wait_for_selector("[role=listbox]", timeout=5000)
    dispatch_page.locator("[role=listbox]").get_by_text("Full", exact=True).click()

    dlg.get_by_label("Select Pickup or Delivery").click()
    dispatch_page.wait_for_selector("[role=listbox]", timeout=5000)
    dispatch_page.locator("[role=listbox]").get_by_text("Delivery", exact=True).click()

    # Customer Name Autocomplete — "E2E Customer" is created by the seed endpoint
    customer_input = dlg.get_by_label("Customer Name")
    customer_input.click()
    customer_input.fill("E2E Customer")
    dispatch_page.locator("[role=option]").filter(
        has_text="E2E Customer"
    ).first.wait_for(timeout=5000)
    dispatch_page.locator("[role=option]").filter(
        has_text="E2E Customer"
    ).first.click()

    # First reference number
    dlg.get_by_label("Reference / PO Number").fill("CR-001")

    # Add a second reference number (button appears in InputAdornment of the last field)
    dlg.get_by_role("button", name="Add New").click()
    # Labels update to "Reference / PO Number 1" and "Reference / PO Number 2"
    dlg.get_by_label("Reference / PO Number 2").wait_for(timeout=5000)
    dlg.get_by_label("Reference / PO Number 2").fill("CR-002")

    # Submit — creates and auto-approves the appointment (Calendar path)
    dlg.get_by_role("button", name="Submit").click()
    dispatch_page.wait_for_selector("[role=dialog]", state="hidden", timeout=10000)

    # The new event appears on the calendar; title shows the first ref number
    expect(
        dispatch_page.locator(".rs__event__item").filter(has_text="CR-001").first
    ).to_be_visible(timeout=15000)

    # This test creates a real record through the UI (not via a fixture), so
    # it has to clean up after itself directly through the API — otherwise
    # every re-run leaves another "CR-001" event on the calendar, and the
    # strict-mode assertion above starts failing once more than one exists.
    access = _dispatch_token()
    resp = req_lib.get(
        f"{BASE_URL}/api/request/",
        params={"search": "CR-002"},
        headers={"Authorization": f"Bearer {access}"},
        timeout=10,
    )
    resp.raise_for_status()
    for r in resp.json():
        if r["company_name"] == "E2E Calendar Create Co":
            _soft_delete(access, r["id"])

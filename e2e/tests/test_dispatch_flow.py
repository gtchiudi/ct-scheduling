"""
E2E tests for the Dispatch user workflow.

Dispatch users can:
  - Land on the Calendar after login
  - Navigate to Pending Requests
  - Approve and decline pending requests
  - View approved appointments on the Calendar
  - Log out
"""

import uuid
from datetime import date, timedelta

import pytest
import requests as req_lib
from playwright.sync_api import expect
from e2e.pages.pending_requests_page import PendingRequestsPage
from e2e.pages.calendar_page import CalendarPage
from e2e.tests.test_calendar_workflow import _dispatch_token, _e2e_warehouse_id, _soft_delete
from e2e_config import BASE_URL


@pytest.fixture
def pending_to_decline():
    """A pending request of this test's own, submitted like the public form does.

    test_approve_request_removes_from_list uses up the one seeded pending
    request, so the decline test must not depend on whatever else is pending.
    """
    access = _dispatch_token()
    company = f"E2E Decline Co {uuid.uuid4().hex[:6].upper()}"
    target = date.today() + timedelta(days=10)
    resp = req_lib.post(
        f"{BASE_URL}/api/request/",
        json={
            "company_name": company,
            "customer_name": "E2E Customer",
            "email": "decline@e2e.test",
            "warehouse": _e2e_warehouse_id(access),
            "ref_number": f"DECL-{uuid.uuid4().hex[:6].upper()}",
            "load_type": "Full",
            "delivery": True,
            "date_time": f"{target.isoformat()}T10:00:00-04:00",
            "approved": False,
            "active": True,
        },
        timeout=10,
    )
    resp.raise_for_status()
    yield company
    _soft_delete(access, resp.json()["id"])  # no-op once declined


@pytest.mark.e2e
def test_dispatch_lands_on_calendar_after_auth(dispatch_page):
    """After fast-login injection, the Dispatch user lands on /Calendar."""
    assert "/Calendar" in dispatch_page.url


@pytest.mark.e2e
def test_pending_requests_link_visible(dispatch_page):
    """The Pending Requests nav button is visible for Dispatch users."""
    calendar = CalendarPage(dispatch_page)
    calendar.assert_pending_requests_link_visible()


@pytest.mark.e2e
def test_navigate_to_pending_requests(dispatch_page):
    """Clicking the Pending Requests nav button goes to /PendingRequests."""
    dispatch_page.get_by_text("Pending Requests").first.click()
    dispatch_page.wait_for_url("**/PendingRequests", timeout=5000)
    assert "/PendingRequests" in dispatch_page.url


@pytest.mark.e2e
def test_pending_requests_table_shows_rows(dispatch_page):
    """The Pending Requests table renders at least one row (seeded data)."""
    pr = PendingRequestsPage(dispatch_page)
    pr.navigate_to()
    pr.wait_for_table()
    assert pr.get_row_count() > 0


@pytest.mark.e2e
def test_approve_request_removes_from_list(dispatch_page):
    """Approving a request removes it from the pending list."""
    pr = PendingRequestsPage(dispatch_page)
    pr.navigate_to()
    pr.wait_for_table()
    initial_count = pr.get_row_count()
    pr.click_request_by_company("E2E Pending Co")
    pr.approve_current_request()
    # Wait for React to re-render the table after the query refetch
    expect(dispatch_page.locator("tbody tr")).not_to_have_count(initial_count, timeout=10000)


@pytest.mark.e2e
def test_decline_request_removes_from_list(dispatch_page, pending_to_decline):
    """Declining a request removes it from the pending list."""
    pr = PendingRequestsPage(dispatch_page)
    pr.navigate_to()
    pr.wait_for_table()
    initial_count = pr.get_row_count()
    pr.click_request_by_company(pending_to_decline)
    pr.decline_current_request()
    # Wait for React to re-render the table after the query refetch
    expect(dispatch_page.locator("tbody tr")).not_to_have_count(initial_count, timeout=10000)


@pytest.mark.e2e
def test_calendar_shows_approved_appointments(dispatch_page):
    """The Calendar displays approved appointments from seeded data."""
    calendar = CalendarPage(dispatch_page)
    calendar.navigate_to()
    calendar.wait_for_scheduler()
    calendar.assert_has_events()


@pytest.mark.e2e
def test_logout_clears_session(dispatch_page):
    """After logging out, the user sees the Login button (no longer authenticated).

    After the Logout component clears tokens and navigates to '/', the browser
    may end up on a different dev-server origin. We explicitly return to BASE_URL
    to verify tokens were cleared — if they weren't, auth would restore from
    localStorage and 'Pending Requests' would still be visible.
    """
    dispatch_page.get_by_role("button", name="User Menu").click()
    dispatch_page.get_by_text("Logout").click()
    dispatch_page.wait_for_load_state("networkidle")
    # Return to the app origin to verify auth state was cleared
    dispatch_page.goto(f"{BASE_URL}/")
    dispatch_page.wait_for_load_state("networkidle")
    dispatch_page.get_by_text("Login").wait_for(timeout=5000)
    assert dispatch_page.get_by_text("Login").is_visible()
    assert not dispatch_page.get_by_text("Pending Requests").is_visible()

"""
E2E tests for the Dispatch user workflow.

Dispatch users can:
  - Land on the Calendar after login
  - Navigate to Pending Requests
  - Approve and decline pending requests
  - View approved appointments on the Calendar
  - Log out
"""

import pytest
from e2e.pages.pending_requests_page import PendingRequestsPage
from e2e.pages.calendar_page import CalendarPage


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
    dispatch_page.get_by_text("Pending Requests").click()
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
    pr.click_first_request()
    pr.approve_current_request()
    # After approval, the row should be removed from the unapproved list
    dispatch_page.wait_for_load_state("networkidle")
    assert pr.get_row_count() < initial_count


@pytest.mark.e2e
def test_decline_request_removes_from_list(dispatch_page, seed_test_data):
    """Declining a request removes it from the pending list."""
    pr = PendingRequestsPage(dispatch_page)
    pr.navigate_to()
    pr.wait_for_table()
    initial_count = pr.get_row_count()
    pr.click_first_request()
    pr.decline_current_request()
    dispatch_page.wait_for_load_state("networkidle")
    assert pr.get_row_count() < initial_count


@pytest.mark.e2e
def test_calendar_shows_approved_appointments(dispatch_page):
    """The Calendar displays approved appointments from seeded data."""
    calendar = CalendarPage(dispatch_page)
    calendar.navigate_to()
    calendar.wait_for_scheduler()
    calendar.assert_has_events()


@pytest.mark.e2e
def test_logout_clears_session(dispatch_page):
    """After logging out, the user sees the Login button (no longer authenticated)."""
    dispatch_page.get_by_role("button", name="User Menu").click()
    dispatch_page.get_by_text("Logout").click()
    dispatch_page.wait_for_load_state("networkidle")
    assert dispatch_page.get_by_text("Login").is_visible()
    # Navigation links for authenticated users should be gone
    assert not dispatch_page.get_by_text("Pending Requests").is_visible()

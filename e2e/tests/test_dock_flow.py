"""
E2E tests for the Dock user workflow.

Dock users are restricted to the Calendar:
  - They land on /Calendar after login
  - The Pending Requests nav link is NOT shown
  - Direct navigation to /PendingRequests redirects them away
  - They can view the Calendar with approved appointments
"""

import pytest
from e2e.pages.calendar_page import CalendarPage


@pytest.mark.e2e
def test_dock_lands_on_calendar(dock_page):
    """After fast-login injection, the Dock user is on /Calendar."""
    assert "/Calendar" in dock_page.url


@pytest.mark.e2e
def test_dock_no_pending_requests_link(dock_page):
    """The Pending Requests button is NOT visible in the header for Dock users."""
    calendar = CalendarPage(dock_page)
    calendar.assert_no_pending_requests_link()


@pytest.mark.e2e
def test_dock_direct_navigate_to_pending_requests_redirects(dock_page):
    """
    Dock users who navigate directly to /PendingRequests should be redirected
    away (the PendingRequests.jsx component checks groups and calls navigate()).

    This test documents the actual frontend behavior: the redirect goes to /Calendar.
    If this test fails, the Dock restriction in PendingRequests.jsx may have regressed.
    """
    dock_page.goto("/PendingRequests")
    dock_page.wait_for_load_state("networkidle")
    # The Dock user should not remain on PendingRequests
    assert "/PendingRequests" not in dock_page.url, (
        "Dock user was not redirected away from /PendingRequests. "
        "Check the group-based redirect in PendingRequests.jsx."
    )


@pytest.mark.e2e
def test_dock_can_view_calendar(dock_page):
    """Dock users can view the Calendar page and see events."""
    calendar = CalendarPage(dock_page)
    calendar.navigate_to()
    calendar.wait_for_scheduler()
    # Calendar should load without error (events may or may not be visible
    # depending on the current week's seeded data)
    assert "/Calendar" in dock_page.url

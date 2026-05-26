"""
E2E tests for the anonymous (unauthenticated) user experience.

Anonymous users can:
  - View the home page
  - Access /RequestForm and submit an appointment request
  - See the Login button in the header

Anonymous users cannot:
  - Access Calendar or PendingRequests (they're redirected or not shown links)
"""

import pytest
from datetime import date, timedelta
from e2e.pages.request_form_page import RequestFormPage


@pytest.mark.e2e
def test_home_page_loads(page):
    """The home page renders without errors."""
    page.goto("/")
    page.wait_for_load_state("networkidle")
    assert page.title() != ""
    # The REQUEST PICKUP/DELIVERY link is present for anonymous users
    # (rendered twice: desktop nav + mobile menu — first is sufficient)
    page.get_by_text("REQUEST PICKUP/DELIVERY").first.wait_for(timeout=5000)
    assert page.get_by_text("REQUEST PICKUP/DELIVERY").first.is_visible()


@pytest.mark.e2e
def test_request_form_accessible_without_login(page):
    """/RequestForm is reachable and shows the form fields without requiring login."""
    form = RequestFormPage(page)
    form.navigate_to()
    assert page.get_by_label("Company Name").is_visible()
    assert page.get_by_label("Email").is_visible()


@pytest.mark.e2e
def test_submit_request_successfully(page):
    """
    A complete, valid appointment request can be submitted anonymously.
    The success dialog appears after submission.
    """
    form = RequestFormPage(page)
    form.navigate_to()

    form.fill_company_name("Acme Trucking")
    form.fill_email("driver@acmetrucking.com")
    form.fill_phone("5551234567")
    form.fill_ref_number("PO-E2E-001")
    form.select_warehouse("123 Test St, Cleveland, OH 44101")
    form.select_load_type("Full")
    form.select_delivery(delivery=True)
    target = date.today() + timedelta(weeks=1)
    form.fill_datetime(
        month=f"{target.month:02d}",
        day=f"{target.day:02d}",
        year=str(target.year),
        hour="09",
        minute="00",
    )

    form.submit()
    form.assert_success_visible()


@pytest.mark.e2e
def test_submit_missing_required_field_shows_error(page):
    """Submitting with a missing required field keeps the Submit button disabled."""
    form = RequestFormPage(page)
    form.navigate_to()
    # Only fill some fields, leave warehouse empty
    form.fill_company_name("Incomplete Co")
    form.fill_email("incomplete@example.com")
    # Do NOT select warehouse — it's required
    form.assert_submit_disabled()


@pytest.mark.e2e
def test_login_link_visible_for_anonymous_user(page):
    """The Login button is visible in the header when not authenticated."""
    page.goto("/")
    page.wait_for_load_state("networkidle")
    page.get_by_text("Login").wait_for(timeout=5000)
    assert page.get_by_text("Login").is_visible()
    # Calendar and Pending Requests are not shown
    assert not page.get_by_text("Calendar", exact=True).is_visible()
    assert not page.get_by_text("Pending Requests").is_visible()

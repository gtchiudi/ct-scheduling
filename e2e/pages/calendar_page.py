"""Page object for /Calendar — the staff scheduler view."""

from .base_page import BasePage


class CalendarPage(BasePage):
    def navigate_to(self):
        self.navigate("/Calendar")

    def wait_for_scheduler(self):
        """Wait for the @aldabil/react-scheduler to render."""
        self.page.wait_for_selector("[data-testid='scheduler'], .rs__outer", timeout=8000)

    def assert_has_events(self):
        events = self.page.locator(".rs__event__item")
        assert events.count() > 0, "Expected at least one calendar event"

    def assert_no_pending_requests_link(self):
        assert not self.page.get_by_text("Pending Requests").is_visible(), \
            "Pending Requests link should not be visible for Dock users"

    def assert_pending_requests_link_visible(self):
        assert self.page.get_by_text("Pending Requests").is_visible(), \
            "Pending Requests link should be visible for Dispatch/Admin users"

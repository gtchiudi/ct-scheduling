"""Page object for /PendingRequests — the staff pending requests table."""

from .base_page import BasePage


class PendingRequestsPage(BasePage):
    def navigate_to(self):
        self.navigate("/PendingRequests")

    def wait_for_table(self):
        """Wait for the table to finish loading."""
        self.page.wait_for_selector("table", timeout=8000)

    def get_row_count(self):
        return self.page.locator("tbody tr").count()

    def click_first_request(self):
        """Click the first row to open the request detail dialog."""
        self.page.locator("tbody tr").first.click()
        self.page.wait_for_selector("[role=dialog]", timeout=5000)

    def approve_current_request(self):
        self.page.get_by_role("button", name="Approve").click()
        self.page.wait_for_load_state("networkidle")

    def decline_current_request(self):
        self.page.get_by_role("button", name="Decline").click()
        # Confirm the decline dialog
        self.page.get_by_role("button", name="Decline").last.click()
        self.page.wait_for_load_state("networkidle")

    def close_dialog(self):
        self.page.get_by_role("button", name="Cancel").click()

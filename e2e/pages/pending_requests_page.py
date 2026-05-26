"""Page object for /PendingRequests — the staff pending requests table."""

from .base_page import BasePage


class PendingRequestsPage(BasePage):
    def navigate_to(self):
        """Navigate to /PendingRequests using the nav link (client-side routing).

        Avoids a full page.goto() reload which races against React re-reading
        auth from localStorage — the component can redirect before atoms hydrate.
        For Dispatch/Admin users the nav link is always present except when
        already on /PendingRequests.
        """
        if "/PendingRequests" not in self.page.url:
            self.page.get_by_text("Pending Requests").first.click()
            self.page.wait_for_url("**/PendingRequests", timeout=8000)

    def wait_for_table(self):
        """Wait for the table to finish loading."""
        self.page.wait_for_selector("table", timeout=10000)

    def get_row_count(self):
        return self.page.locator("tbody tr").count()

    def click_first_request(self):
        """Click the first row to open the request detail dialog."""
        self.page.locator("tbody tr").first.click()
        self.page.wait_for_selector("[role=dialog]", timeout=5000)

    def click_request_by_company(self, company_name):
        """Click a specific row by company name to open the request detail dialog."""
        row = self.page.locator("tbody tr").filter(has_text=company_name).first
        row.wait_for(timeout=5000)
        row.click()
        self.page.wait_for_selector("[role=dialog]", timeout=5000)

    def approve_current_request(self):
        self.page.get_by_role("button", name="Approve").click()
        # Wait for the dialog to close (Form calls closeModal after the PATCH succeeds)
        self.page.wait_for_selector("[role='dialog']", state="hidden", timeout=10000)
        self.page.wait_for_load_state("networkidle")

    def decline_current_request(self):
        self.page.get_by_role("button", name="Decline").first.click()
        # A confirmation dialog opens — scope to it so we don't hit the form's button
        confirm_dialog = self.page.get_by_role("dialog").last
        confirm_dialog.wait_for(timeout=5000)
        confirm_dialog.get_by_role("button", name="Decline").click()
        # Wait for the row to disappear from the table (query refetch driven by invalidation)
        self.page.wait_for_load_state("networkidle")

    def close_dialog(self):
        self.page.get_by_role("button", name="Cancel").click()

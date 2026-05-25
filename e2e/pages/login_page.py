"""Page object for /login — staff login form."""

from .base_page import BasePage


class LoginPage(BasePage):
    def navigate_to(self):
        self.navigate("/Login")

    def fill_credentials(self, username, password):
        self.page.get_by_label("Username").fill(username)
        self.page.get_by_label("Password").fill(password)

    def submit(self):
        self.page.get_by_role("button", name="Login").click()
        self.page.wait_for_load_state("networkidle")

    def assert_error_visible(self):
        # The login form shows an error message on failure
        assert self.page.locator("text=Invalid").is_visible() or \
               self.page.locator("[role=alert]").is_visible()

    def assert_on_calendar(self):
        self.page.wait_for_url("**/Calendar", timeout=5000)

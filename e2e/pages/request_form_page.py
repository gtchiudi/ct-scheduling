"""Page object for /RequestForm — the public appointment request form."""

from .base_page import BasePage


class RequestFormPage(BasePage):
    def navigate_to(self):
        self.navigate("/RequestForm")

    def fill_company_name(self, name):
        self.page.get_by_label("Company Name").fill(name)

    def fill_email(self, email):
        self.page.get_by_label("Email").fill(email)

    def fill_phone(self, phone):
        self.page.get_by_label("Phone Number").fill(phone)

    def fill_ref_number(self, ref):
        self.page.get_by_label("Reference / PO Number").first.fill(ref)

    def select_warehouse(self, name):
        """Select the warehouse from the dropdown."""
        self.page.get_by_label("Warehouse").click()
        self.page.get_by_role("option", name=name).click()

    def select_load_type(self, load_type):
        self.page.get_by_label("Load Type").click()
        self.page.get_by_role("option", name=load_type).click()

    def select_delivery(self, delivery=True):
        value = "Delivery" if delivery else "Pickup"
        self.page.get_by_label("Delivery/Pickup").click()
        self.page.get_by_role("option", name=value).click()

    def submit(self):
        self.page.get_by_role("button", name="Submit").click()

    def assert_success_visible(self):
        self.page.wait_for_selector("text=Request Submitted", timeout=5000)

    def assert_submit_disabled(self):
        assert self.page.get_by_role("button", name="Submit").is_disabled()

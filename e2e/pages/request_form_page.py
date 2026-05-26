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

    def _select_mui_option(self, label, option_text, timeout=8000):
        """Open a MUI Select by label and click an option by text.

        Scopes the search to the open listbox so it works regardless of
        portal vs. inline rendering and avoids matching stale DOM nodes.
        """
        self.page.get_by_label(label).click()
        listbox = self.page.locator('[role="listbox"]')
        listbox.wait_for(timeout=timeout)
        listbox.get_by_text(option_text, exact=True).click()

    def select_warehouse(self, name):
        """Select a warehouse. On /RequestForm the option text is the address."""
        self._select_mui_option("Warehouse", name)

    def select_load_type(self, load_type):
        self._select_mui_option("Load Type", load_type)

    def select_delivery(self, delivery=True):
        value = "Delivery" if delivery else "Pickup"
        self._select_mui_option("Select Pickup or Delivery", value)

    def fill_datetime(self, month, day, year, hour, minute):
        """Fill the MUI DateTimePicker (24h, ampm=False) by typing into each section.

        MUI DateTimePicker uses section-based masked input: MM / DD / YYYY HH : mm.
        After a section is complete (e.g. 2 digits for month, 4 for year) MUI
        auto-advances to the next section — do NOT Tab between them or the Tab
        will skip a section (year auto-advances to hours, then Tab jumps to minutes).

        Date must be in the future (today is disabled on /RequestForm).
        """
        field = self.page.get_by_label("Select Appointment Date and Time")
        field.click()
        for part in [month, day, year, hour, minute]:
            self.page.keyboard.type(str(part))

    def submit(self):
        self.page.get_by_role("button", name="Submit").click()

    def assert_success_visible(self):
        self.page.wait_for_selector("text=Request Submitted", timeout=8000)

    def assert_submit_disabled(self):
        assert self.page.get_by_role("button", name="Submit").is_disabled()

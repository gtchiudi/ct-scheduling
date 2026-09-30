"""Page object for /AuditLog — the Admin/Dispatch audit search page.

Two tabs ("Appointment activity", "Notifications"), each with filter controls,
a paged MUI table and an "Export CSV" button that downloads the current filters.
"""

import csv
import io
import re

from playwright.sync_api import expect

from .base_page import BasePage

EVENTS_TABLE = "[data-testid='audit-events-table']"
NOTIFICATIONS_TABLE = "[data-testid='audit-notifications-table']"


class AuditLogPage(BasePage):
    # ── Navigation ──────────────────────────────────────────────────────────
    def navigate_via_nav_link(self):
        """Click the "Audit Log" header link (client-side routing)."""
        self.page.get_by_role("link", name="Audit Log").or_(
            self.page.get_by_role("button", name="Audit Log")
        ).first.click()
        self.page.wait_for_url("**/AuditLog", timeout=8000)

    def navigate_to(self):
        """Hard-navigate to /AuditLog (auth already injected into localStorage)."""
        self.navigate("/AuditLog")

    def nav_link(self):
        # .first: the mobile nav menu keeps a hidden copy of each link mounted.
        return self.page.get_by_text("Audit Log", exact=True).first

    # ── Tabs ────────────────────────────────────────────────────────────────
    def open_events_tab(self):
        self.page.get_by_role("tab", name="Appointment activity").click()
        self.wait_for_events_table()

    def open_notifications_tab(self):
        self.page.get_by_role("tab", name="Notifications").click()
        self.wait_for_notifications_table()

    def wait_for_events_table(self):
        self._wait_for_table(EVENTS_TABLE)

    def wait_for_notifications_table(self):
        self._wait_for_table(NOTIFICATIONS_TABLE)

    def _wait_for_table(self, selector):
        table = self.page.locator(selector)
        expect(table).to_be_visible(timeout=15000)
        # Loading row carries a progressbar; wait until data or the empty text shows.
        expect(table.get_by_role("progressbar")).to_have_count(0, timeout=15000)

    # ── Rows ────────────────────────────────────────────────────────────────
    def rows(self, table_selector=EVENTS_TABLE):
        return self.page.locator(f"{table_selector} [data-testid='audit-row']")

    def column_index(self, header_text, table_selector=EVENTS_TABLE):
        headers = self.page.locator(f"{table_selector} thead th").all_inner_texts()
        return [h.strip() for h in headers].index(header_text)

    def column_values(self, header_text, table_selector=EVENTS_TABLE):
        idx = self.column_index(header_text, table_selector)
        return [
            row.locator("td").nth(idx).inner_text().strip()
            for row in self.rows(table_selector).all()
        ]

    # ── Filters ─────────────────────────────────────────────────────────────
    def _open_select(self, label):
        """Open a MUI Select by its visible label inside the current tab."""
        panel = self.page.locator("[role=tabpanel]:not([hidden])")
        # MUI Select renders role=combobox named "<label> <current value>".
        panel.get_by_role("combobox", name=re.compile(rf"^{re.escape(label)}\b")).first.click()
        listbox = self.page.locator("[role=listbox]")
        listbox.wait_for(timeout=5000)
        return listbox

    def select_single(self, label, option_text):
        listbox = self._open_select(label)
        listbox.get_by_role("option", name=option_text, exact=True).click()
        expect(self.page.locator("[role=listbox]")).to_have_count(0, timeout=5000)

    def select_multi(self, label, *option_texts):
        listbox = self._open_select(label)
        for text in option_texts:
            listbox.get_by_role("option", name=text, exact=True).click()
        # Multi-selects stay open after a pick; Escape closes the menu.
        self.page.keyboard.press("Escape")
        expect(self.page.locator("[role=listbox]")).to_have_count(0, timeout=5000)

    def search(self, text):
        """Type into the current tab's Search box (the page debounces it)."""
        panel = self.page.locator("[role=tabpanel]:not([hidden])")
        box = panel.get_by_label("Search", exact=True)
        box.fill(text)

    def clear_search(self):
        panel = self.page.locator("[role=tabpanel]:not([hidden])")
        panel.get_by_role("button", name="Clear search").click()

    def filter_person(self, name):
        self.select_single("Person", name)

    def filter_actions(self, *action_labels):
        self.select_multi("Action", *action_labels)

    def filter_notification_types(self, *kind_labels):
        self.select_multi("Type", *kind_labels)

    def wait_for_rows_to_match(self, header_text, expected, table_selector=EVENTS_TABLE,
                               timeout=15000):
        """Wait until the table has rows and every value in a column is in `expected`."""
        expected = set(expected)
        deadline_ms = timeout
        step = 250
        values = []
        while deadline_ms > 0:
            self._wait_for_table(table_selector)
            values = self.column_values(header_text, table_selector)
            if values and set(values) <= expected:
                return values
            self.page.wait_for_timeout(step)
            deadline_ms -= step
        raise AssertionError(
            f"Column {header_text!r} never matched {sorted(expected)}; last values: {values}"
        )

    # ── Export ──────────────────────────────────────────────────────────────
    def export_csv(self):
        """Click Export CSV in the visible tab; return (filename, header, rows)."""
        panel = self.page.locator("[role=tabpanel]:not([hidden])")
        with self.page.expect_download(timeout=15000) as download_info:
            panel.get_by_role("button", name="Export CSV").click()
        download = download_info.value
        path = download.path()
        with open(path, encoding="utf-8-sig", newline="") as fh:
            parsed = list(csv.reader(io.StringIO(fh.read())))
        return download.suggested_filename, parsed[0], parsed[1:]

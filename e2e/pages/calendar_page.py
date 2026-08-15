"""Page object for /Calendar — the staff scheduler view."""

from .base_page import BasePage
from e2e_config import BASE_URL


class CalendarPage(BasePage):
    def navigate_to(self):
        """Navigate to /Calendar using the nav link (client-side routing).

        Avoids a full page.goto() reload which races against React re-reading
        auth from localStorage — Calendar.useEffect redirects to /Login when
        authenticated is still false on first render.
        """
        if "/Calendar" in self.page.url:
            return  # already here, scheduler is already loaded
        self.page.get_by_text("Calendar").first.click()
        self.page.wait_for_url("**/Calendar", timeout=8000)

    def force_navigate_to(self):
        """Hard-navigate to /Calendar to pick up newly created appointments.

        Unlike navigate_to(), this always does a full page load so the React app
        fetches fresh data from the API. Safe to call after _inject_auth has already
        populated localStorage (tokens + warehouse cache) — no auth race.
        """
        self.page.goto(f"{BASE_URL}/Calendar")
        self.page.wait_for_load_state("networkidle")
        self.wait_for_scheduler()

    def wait_for_scheduler(self):
        """Wait for the @aldabil/react-scheduler grid to render.

        Calendar.jsx wraps the Scheduler in <Box id="calendar">.
        The rs__outer class is the scheduler's outermost container.
        Use whichever appears first; give extra time for the data fetch.
        """
        self.page.wait_for_selector("#calendar, .rs__outer", timeout=15000)

    def wait_for_event(self, ref_number, timeout=15000):
        """Wait until an event with the given ref number is visible on the calendar."""
        self.page.locator(".rs__event__item").filter(has_text=ref_number).first.wait_for(
            state="visible", timeout=timeout
        )

    def click_event_by_ref(self, ref_number):
        """Click a calendar event identified by its reference number."""
        self.page.locator(".rs__event__item").filter(has_text=ref_number).first.click()
        self.page.wait_for_selector("[role=dialog]", timeout=5000)

    def click_empty_slot(self):
        """Click an empty time slot in the scheduler to open the Create Appointment dialog.

        @aldabil/react-scheduler cell class breakdown:
          rs__cell rs__header rs__time   — time-label header (top-left)
          rs__cell rs__header            — day-name header column
          rs__cell rs__time              — time-label body column (left edge)
          rs__cell                       — body day-column cell wrapper (span)

        The actual clickable element is the Cell component rendered INSIDE the rs__cell
        span. It carries tabindex="0" when the scheduler is editable (the default).
        The click triggers `triggerDialog(true, {start, end})` which renders CustomEditor.

        We wait for "Create Appointment" text rather than a generic [role=dialog] because
        MUI DateTimePicker and similar components keep hidden dialogs in the DOM that
        would otherwise match first.
        """
        # The MUI Button inside each empty rs__cell has tabindex="0" and carries the
        # scheduler's onClick handler (triggerDialog).  In headless Chromium the
        # pointer-events chain can be tricky, so we use a JS dispatch approach:
        # find the first empty body-cell button and fire a real click event on it.
        clicked = self.page.evaluate("""
            (() => {
                const cells = Array.from(
                    document.querySelectorAll('#calendar .rs__cell')
                ).filter(c =>
                    !c.classList.contains('rs__header') &&
                    !c.classList.contains('rs__time') &&
                    !c.querySelector('.rs__event__item')
                );
                for (const cell of cells) {
                    const btn = cell.querySelector('button[tabindex="0"]');
                    if (btn) {
                        btn.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
                        return btn.getAttribute('aria-label') || 'clicked';
                    }
                }
                return null;
            })()
        """)
        if not clicked:
            raise RuntimeError("No empty scheduler cell button found to create appointment")
        # Wait for the Create Appointment title to be visible (CustomEditor opens)
        self.page.get_by_text("Create Appointment").wait_for(state="visible", timeout=8000)

    def assert_has_events(self):
        # Wait for at least one event to appear — events load async after the scheduler renders
        self.page.wait_for_selector(".rs__event__item", timeout=15000)
        events = self.page.locator(".rs__event__item")
        assert events.count() > 0, "Expected at least one calendar event"

    def assert_no_pending_requests_link(self):
        # .first: the mobile nav Menu keeps its MenuItems mounted (keepMounted) even
        # when closed, so "Pending Requests" can match both the desktop button and
        # the hidden mobile menu item — .first pins this to DOM order (desktop first).
        assert not self.page.get_by_text("Pending Requests").first.is_visible(), \
            "Pending Requests link should not be visible for Dock users"

    def assert_pending_requests_link_visible(self):
        assert self.page.get_by_text("Pending Requests").first.is_visible(), \
            "Pending Requests link should be visible for Dispatch/Admin users"

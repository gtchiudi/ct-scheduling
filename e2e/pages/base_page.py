"""Shared navigation and wait helpers used by all page objects."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from e2e_config import BASE_URL  # noqa: E402


class BasePage:
    def __init__(self, page):
        self.page = page

    def navigate(self, path):
        self.page.goto(f"{BASE_URL}{path}")
        self.page.wait_for_load_state("networkidle")

    def assert_url_contains(self, substring):
        assert substring in self.page.url, (
            f"Expected URL to contain '{substring}', got: {self.page.url}"
        )

    def get_text(self, selector):
        return self.page.locator(selector).inner_text()

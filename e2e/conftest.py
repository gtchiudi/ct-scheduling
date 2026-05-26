"""
Shared Playwright fixtures for all E2E tests.

Setup requirements before running E2E tests:
  1. App must be running (make test-e2e assumes http://localhost:8000)
  2. A Dispatch user and Dock user must exist (created by seed_test_data fixture)

Fast-login pattern:
  Rather than clicking through the login form for every test, inject_*_auth
  fixtures POST to /token/ once per session to get a JWT, then set it in
  localStorage via page.evaluate(). The app reads tokens from localStorage on
  mount and authenticates transparently.
"""

import os
import pytest
import requests
from playwright.sync_api import sync_playwright

import sys
sys.path.insert(0, os.path.dirname(__file__))
from e2e_config import BASE_URL, HEADLESS, SLOW_MO, BROWSER  # noqa: E402

# ---------------------------------------------------------------------------
# Credentials for seeded test users (created by seed_test_data)
# ---------------------------------------------------------------------------
DISPATCH_USERNAME = os.environ.get("E2E_DISPATCH_USER", "e2e_dispatch")
DISPATCH_PASSWORD = os.environ.get("E2E_DISPATCH_PASS", "TestE2eD!spatch123!")
DOCK_USERNAME = os.environ.get("E2E_DOCK_USER", "e2e_dock")
DOCK_PASSWORD = os.environ.get("E2E_DOCK_PASS", "TestE2eD0ck123!")


# ---------------------------------------------------------------------------
# Browser / page fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_instance():
    """Single browser process for the entire test session."""
    with sync_playwright() as p:
        browser_type = getattr(p, BROWSER)
        browser = browser_type.launch(headless=HEADLESS, slow_mo=SLOW_MO)
        yield browser
        browser.close()


@pytest.fixture
def page(browser_instance):
    """Fresh browser context + page for each test (empty storage state)."""
    context = browser_instance.new_context(base_url=BASE_URL)
    page = context.new_page()
    yield page
    context.close()


# ---------------------------------------------------------------------------
# Fast-login helpers
# ---------------------------------------------------------------------------

def _get_jwt_tokens(username, password):
    """POST to /token/ and return (access, refresh) token strings."""
    response = requests.post(
        f"{BASE_URL}/token/",
        json={"username": username, "password": password},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    return data["access"], data["refresh"]


def _get_warehouse_data(access_token):
    """Fetch warehouse list from the API to pre-seed localStorage.

    The Calendar component maps warehouseData to checkboxes in a useEffect with
    [] deps (runs once on mount). On a fresh session the atom is empty because the
    async warehouse fetch hasn't resolved yet, so parsedWarehouseData stays []
    and the events filter returns nothing. Pre-populating warehouseData in
    localStorage before navigating to /Calendar avoids this race.
    """
    try:
        resp = requests.get(
            f"{BASE_URL}/api/warehouse/",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return []


def _inject_auth(page, access_token, refresh_token, groups, user_initial):
    """
    Inject JWT tokens and user metadata into localStorage so the React app
    authenticates without going through the login form.

    The app (atoms.jsx) reads these keys from localStorage on mount:
      accessToken, refreshToken, userGroups, userInitial, lastLoginDatetime

    Also pre-populates warehouseData + lastWarehouseRefresh so the Calendar's
    useEffect finds the warehouse list on first render and events can be filtered.
    """
    warehouse_data = _get_warehouse_data(access_token)
    page.goto(BASE_URL)
    page.evaluate(
        """([access, refresh, groups, initial, warehouses]) => {
            localStorage.setItem('accessToken', JSON.stringify(access));
            localStorage.setItem('refreshToken', JSON.stringify(refresh));
            localStorage.setItem('userGroups', JSON.stringify(groups));
            localStorage.setItem('userInitial', JSON.stringify(initial));
            localStorage.setItem('lastLoginDatetime', JSON.stringify(new Date().toISOString()));
            // Pre-populate warehouse cache so Calendar renders events on first mount
            if (warehouses && warehouses.length > 0) {
                localStorage.setItem('warehouseData', JSON.stringify(warehouses));
                localStorage.setItem('lastWarehouseRefresh', JSON.stringify(new Date().toISOString()));
            }
        }""",
        [access_token, refresh_token, groups, user_initial, warehouse_data],
    )
    page.goto(f"{BASE_URL}/Calendar")
    page.wait_for_load_state("networkidle")


@pytest.fixture
def dispatch_page(page):
    """Page with Dispatch user pre-authenticated via localStorage injection."""
    access, refresh = _get_jwt_tokens(DISPATCH_USERNAME, DISPATCH_PASSWORD)
    _inject_auth(page, access, refresh, ["Dispatch"], "D")
    return page


@pytest.fixture
def dock_page(page):
    """Page with Dock user pre-authenticated via localStorage injection."""
    access, refresh = _get_jwt_tokens(DOCK_USERNAME, DOCK_PASSWORD)
    _inject_auth(page, access, refresh, ["Dock"], "K")
    return page


# ---------------------------------------------------------------------------
# Data seeding
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def seed_test_data():
    """
    Seed the database with E2E test users and a warehouse once per session.

    Creates:
      - Dispatch user (e2e_dispatch / E2eDispatch123!)
      - Dock user (e2e_dock / E2eDock123!)
      - One warehouse named "E2E Test Warehouse"
      - One pending (unapproved) request
      - One approved request

    The seed endpoint /api/e2e-seed/ must exist in the running app,
    OR run this management command before tests:
      python manage.py create_e2e_fixtures

    If seeding fails, tests are skipped rather than failing with confusing errors.
    """
    try:
        response = requests.post(
            f"{BASE_URL}/api/e2e-seed/",
            json={
                "dispatch_username": DISPATCH_USERNAME,
                "dispatch_password": DISPATCH_PASSWORD,
                "dock_username": DOCK_USERNAME,
                "dock_password": DOCK_PASSWORD,
            },
            timeout=15,
        )
        if response.status_code not in (200, 201, 409):  # 409 = already seeded
            pytest.skip(
                f"E2E seed endpoint returned {response.status_code}. "
                "Ensure the app is running and the seed endpoint is available."
            )
    except requests.exceptions.ConnectionError:
        pytest.skip(
            f"Could not connect to {BASE_URL}. "
            "Start the app before running E2E tests: make test-e2e"
        )

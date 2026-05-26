"""
Playwright E2E configuration.

Environment variables (all optional — defaults shown):
  E2E_BASE_URL   http://localhost:8000   Target app URL (local, staging, or prod)
  E2E_HEADLESS   true                    Run browsers headlessly
  E2E_BROWSER    chromium                Browser to use (chromium | firefox | webkit)
  E2E_SLOW_MO    0                       Millisecond delay between actions (for debugging)

Usage examples:
  make test-e2e                                        # local dev server
  make test-e2e E2E_BASE_URL=https://staging.example.com   # staging
  E2E_HEADLESS=false make test-e2e                     # watch mode
  E2E_SLOW_MO=500 make test-e2e                        # slow motion for debugging
"""

import os

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:5173")
HEADLESS = os.environ.get("E2E_HEADLESS", "true").lower() == "false"
SLOW_MO = int(os.environ.get("E2E_SLOW_MO", "0"))
BROWSER = os.environ.get("E2E_BROWSER", "chromium")

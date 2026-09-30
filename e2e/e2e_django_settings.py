"""
Django settings overlay for running the app locally under E2E tests.

Imports the real settings and only changes what a local E2E run needs:
  - DEBUG=True so the /api/e2e-seed/ endpoint is enabled.
  - Emails go to the console instead of smtp.gmail.com (no real mail is sent,
    and sends are recorded as successful). Set E2E_EMAIL_BACKEND to override.
  - E2E_EMAIL_FAIL=1 points SMTP at a closed local port so every email send
    fails (NotificationLog status "failed", error "Connection refused").

Usage (from the repo root):
  cd backend && PYTHONPATH=../e2e DJANGO_SETTINGS_MODULE=e2e_django_settings \
      python manage.py runserver 8000
  cd frontend && npm run dev          # Vite on :5173, proxies /api and /token/ to :8000
  make test-e2e E2E_BASE_URL=http://localhost:5173

The database is backend/db.sqlite3 (unchanged from server.settings). Set
E2E_DB_PATH to point the server at a copy instead (e.g. a scratch copy with
pending migrations applied).
"""

import os

from server.settings import *  # noqa: F401,F403

DEBUG = True
EMAIL_BACKEND = os.environ.get(
    "E2E_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)

if os.environ.get("E2E_DB_PATH"):
    DATABASES["default"]["NAME"] = os.environ["E2E_DB_PATH"]  # noqa: F405

if os.environ.get("E2E_EMAIL_FAIL") == "1":
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = "127.0.0.1"
    EMAIL_PORT = 9          # nothing listens here: connection refused
    EMAIL_USE_TLS = False
    EMAIL_TIMEOUT = 5

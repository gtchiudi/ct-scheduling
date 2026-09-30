# Test Suite — CT-Scheduling

## Overview

Three testing tiers, each with a distinct purpose:

| Tier | Tool | Speed | When to Run |
|------|------|-------|-------------|
| Backend unit/integration | pytest-django | ~5s | Every commit |
| Frontend component | Vitest + RTL | ~3s | Every commit |
| E2E | Playwright (Python) | ~60s+ | Post-deploy, on-demand |

**Philosophy:** Fast unit tests gate every deploy. E2E tests validate critical user flows against a live instance — they run post-deploy or on-demand against staging.

---

## Quick Start

```bash
# Run everything that gates deploys
make test           # backend unit tests
make test-frontend  # frontend component tests

# Deploy with test gate
make deploy-tested  # runs both test targets, then build + deploy

# E2E (requires running app)
make test-e2e
make test-e2e E2E_BASE_URL=https://staging.example.com
```

---

## Backend Unit Tests

### Setup

```bash
pip install -r requirements-test.txt
```

### Run

```bash
make test
# or directly:
python -m pytest -q
# with coverage:
python -m pytest --cov=members --cov-report=html:backend/htmlcov
```

Coverage report opens at `backend/htmlcov/index.html`.

### File Index

| File | What It Tests | Tests |
|------|---------------|-------|
| `backend/members/tests/conftest.py` | Shared fixtures (users, clients, data, mocks) | — |
| `backend/members/tests/test_auth.py` | JWT token lifecycle (obtain, refresh, blacklist, expiry) | 6 |
| `backend/members/tests/test_permissions.py` | Endpoint access control per user role | 11 |
| `backend/members/tests/test_request_crud.py` | Create/list/filter/delete appointments + `load_config` | 22 |
| `backend/members/tests/test_business_logic.py` | All branches in `RequestView.update()` | 21 |
| `backend/members/tests/test_warehouse_customer.py` | Warehouse and Customer CRUD + search | 7 |
| `backend/members/tests/test_utility_views.py` | `UserGroupsView` and `PendingRequestStatsView` | 7 |
| `backend/members/tests/test_audit_events.py` | Audit capture: `AppointmentEvent` rows per action, diffs, no-op saves | 31 |
| `backend/members/tests/test_notification_log.py` | `NotificationLog` rows for every email/SMS send (sent/failed) | 17 |
| `backend/members/tests/test_audit_api.py` | `/api/audit/*` endpoints (filters, search, paging, CSV, permissions) | 78 |
| `backend/members/tests/test_audit_retention.py` | `prune_audit_logs` command, retention settings, read-only admin | 24 |
| `backend/members/tests/test_audit_acceptance.py` | Black-box audit trail acceptance: full lifecycle journey, cancel/decline, no-op save, failed email/SMS, permissions matrix (anon/Dock/Dispatch/Admin/superuser × 4 endpoints), filters, paging, CSV, timeline, actors; regression tests for BUG-1..6 (anonymous `/api/request/` lock-down, `/slots/`, `remove`, seconds precision, retention env, admin cascade); plus regression tests for BUG-7..10 (warehouse writes, account endpoints superuser-only, no password hashes, `unapproved` audited) | 85 |

**Total: 309 backend tests** (all passing; 74 before the audit trail)

---

## Frontend Component Tests

### Setup

```bash
cd frontend && npm install
```

### Run

```bash
make test-frontend
# or from within frontend/:
npm run test          # single run
npm run test:watch    # watch mode (re-runs on file change)
npm run test:coverage # with coverage report
```

### File Index

| File | What It Tests | Tests |
|------|---------------|-------|
| `frontend/src/__tests__/utils/validation.test.js` | `validateEmail`, `validatePhone` edge cases | 14 |
| `frontend/src/__tests__/utils/datetime.test.js` | `toApiDateTime` keeps the UTC offset | 3 |
| `frontend/src/__tests__/components/FormActions.test.jsx` | Button rendering per path/workflow state | 23 |
| `frontend/src/__tests__/components/HeaderBar.test.jsx` | Nav links per auth state and user group (incl. Audit Log link) | 33 |
| `frontend/src/__tests__/components/AppointmentSearchDrawer.test.jsx` | Debounced search, result rendering, selection | 5 |
| `frontend/src/__tests__/components/Form.test.jsx` | Delivery-only "Palletized or Floor Loaded" dropdown, slots endpoint, offset datetimes, Remove from Calendar | 15 |
| `frontend/src/__tests__/components/ActivityHistory.test.jsx` | Activity history section in the appointment window | 13 |
| `frontend/src/__tests__/routes/AuditLog.test.jsx` | Audit Log page: tabs, filters, search, paging, CSV export, Dock redirect | 19 |

**Total: 125 frontend tests** (72 before the audit trail)

---

## E2E Tests

### Prerequisites

1. **Install Playwright browser:**
   ```bash
   pip install playwright
   playwright install chromium
   ```

2. **The app must be running.** For local testing, run Django on :8000 and the Vite dev
   server on :5173 (Vite proxies `/api` and `/token/` to Django). `E2E_BASE_URL` defaults to
   the Vite server, `http://localhost:5173`. Django on its own does not serve the React bundle in
   development, because `backend/templates/index.html` is only refreshed by the Docker build.
   ```bash
   cd backend && python manage.py migrate
   cd backend && PYTHONPATH=../e2e DJANGO_SETTINGS_MODULE=e2e_django_settings \
       python manage.py runserver 8000
   # (in another terminal)
   cd frontend && npm run dev
   ```
   `e2e/e2e_django_settings.py` wraps `server.settings`. It sets `DEBUG=True` so the seed
   endpoint works, and sends email to the console backend instead of smtp.gmail.com. Set
   `E2E_DB_PATH=/path/to/copy.sqlite3` to run against a copy of `backend/db.sqlite3`.
   Set `E2E_EMAIL_FAIL=1` to make every email send fail (SMTP pointed at a closed local port),
   which is useful for checking "failed" notification rows.

3. **Seed test users.** E2E tests require two users with known credentials:
   - **Dispatch user:** `e2e_dispatch` / `TestE2eD!spatch123!` (in Dispatch group)
   - **Dock user:** `e2e_dock` / `TestE2eD0ck123!` (in Dock group)

   The `seed_test_data` fixture in `e2e/conftest.py` attempts this automatically via
   a `POST /api/e2e-seed/` endpoint (if implemented), or you can create them manually:
   ```bash
   cd backend
   python manage.py shell -c "
   from django.contrib.auth.models import User, Group
   g_dispatch, _ = Group.objects.get_or_create(name='Dispatch')
   g_dock, _ = Group.objects.get_or_create(name='Dock')
   u1 = User.objects.create_user('e2e_dispatch', password='TestE2eD!spatch123!')
   u1.groups.add(g_dispatch)
   u2 = User.objects.create_user('e2e_dock', password='TestE2eD0ck123!')
   u2.groups.add(g_dock)
   "
   ```

### Run

```bash
make test-e2e                                              # local (http://localhost:5173)
make test-e2e E2E_BASE_URL=https://staging.example.com    # staging
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:5173` | Target app URL |
| `E2E_HEADLESS` | `true` | Run browsers headlessly |
| `E2E_BROWSER` | `chromium` | Browser (`chromium`, `firefox`, `webkit`) |
| `E2E_SLOW_MO` | `0` | Millisecond delay between actions (for debugging) |
| `E2E_DISPATCH_USER` | `e2e_dispatch` | Dispatch test user username |
| `E2E_DISPATCH_PASS` | `TestE2eD!spatch123!` | Dispatch test user password |
| `E2E_DOCK_USER` | `e2e_dock` | Dock test user username |
| `E2E_DOCK_PASS` | `TestE2eD0ck123!` | Dock test user password |

### File Index

| File | What It Tests | Tests |
|------|---------------|-------|
| `e2e/tests/test_anonymous_flow.py` | Public form submission, login link visibility | 5 |
| `e2e/tests/test_dispatch_flow.py` | Approve/decline requests, calendar, logout | 8 |
| `e2e/tests/test_calendar_workflow.py` | Check-in → dock → complete, edit, create with multiple refs | 3 |
| `e2e/tests/test_dock_flow.py` | Calendar access, no pending requests link, redirect | 4 |
| `e2e/tests/test_audit_trail.py` | Activity history after a UI edit (and hidden for Dock), Audit Log link/page, filter by action + person, Notifications tab, Export CSV matches filters, search by reference on both tabs, Dock: no link / redirect / API 403, anonymous API 401; BUG-5 regression (no-op save from a Central-time browser keeps the date) | 17 |
| `e2e/tests/test_request_fixes.py` | b09077f regressions: anonymous `/api/request/` GET/PUT/PATCH/DELETE/remove rejected, `/slots/` returns only 3 fields; public form first-available + booked slots hidden (Eastern and Central browsers); Remove from Calendar → `removed`, no decline email, filterable in Audit Log; Central-time calendar create and approve store the picked time; week-edge events render and range query uses UTC instants | 14 |
| `e2e/pages/audit_log_page.py` | Page object for `/AuditLog` (tabs, filters, rows, CSV download) | — |
| `e2e/e2e_django_settings.py` | Local Django settings overlay for E2E runs (DEBUG, console email, `E2E_DB_PATH`) | — |

**Total: 51 E2E tests**

Manual QA steps (email/SMS failures, retention command, migration import, deploy checklist)
are in [`MANUAL_TEST_PLAN.md`](MANUAL_TEST_PLAN.md).

---

## Mocking Strategy

### Backend — Email
`send_email` in `views.py` is imported as `from .messages import send_email`. The live reference
lives at `members.views.send_email` — patch there (not at the definition site in `messages.py`):

```python
# In conftest.py / per-test
mocker.patch("members.views.send_email")
```

### Backend — SMS (Twilio)
Same pattern — `send_text` is imported into `views.py` and called there:

```python
mocker.patch("members.views.send_text")
```

Both mocks are provided as fixtures (`mock_email`, `mock_sms`) in `backend/members/tests/conftest.py`.

### Frontend — Jotai Atoms
Several atoms use `atomWithStorage` with `onMount` side effects that reset state
when no localStorage token is present. Tests mock `atoms.jsx` with plain atoms:

```js
vi.mock('../../components/atoms.jsx', () => ({
  authenticatedAtom: atom(false),
  userGroupsAtom: atom([]),
  userInitialAtom: atom('U'),
  ...
}))
```

Then control state via a Jotai `createStore()`:

```js
const store = createStore()
store.set(authenticatedAtom, true)
store.set(userGroupsAtom, ['Dispatch'])
```

### Frontend — API Calls
MSW intercepts HTTP calls in jsdom. Default handler in `src/__tests__/mocks/handlers.js`
returns `{ pending_count: 2, has_urgent_requests: false }` for the pending stats endpoint.
Override per-test using `server.use(http.get(...))`.

### Backend — JWT in Tests (No HTTP)
Generate tokens in-process — no HTTP call needed:

```python
from rest_framework_simplejwt.tokens import RefreshToken
token = RefreshToken.for_user(user)
client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
```

### E2E — Fast Login
Rather than filling the login form for every test, tokens are obtained once and
injected into `localStorage` via `page.evaluate()`. The React app reads them on
mount and authenticates transparently. See `e2e/conftest.py`: `inject_dispatch_auth`.

---

## Known Gaps and Documented Bugs

### `IsAuthenticatedOrPostOnly` (fixed in b09077f)
Previously `has_permission` returned the `IsAuthenticated` class (always truthy), so anonymous
users could read every appointment and PUT/DELETE them. Now anonymous access to `/api/request/`
is limited to `create` (public form submit) and `GET /api/request/slots/`, which returns only
`warehouse`, `date_time` and `appointment_length`. Everything else returns 401.

Covered by: `test_audit_acceptance.py::test_anonymous_cannot_read_or_modify_requests`,
`test_bug_anonymous_delete_is_rejected`, `test_anonymous_slots_*`, and
`e2e/tests/test_request_fixes.py::test_anonymous_request_api_is_rejected`.

### Permission bugs fixed after the second review (`test_audit_acceptance.py`, section 11)
- **BUG-7** `WarehouseView` is now `IsAuthenticatedOrReadOnly`: anonymous users can list
  warehouses (the public form needs it) but not change them.
- **BUG-8** `UserView`, `GroupView` and `ApprovalLogView` (`/api/user/`, `/api/group/`,
  `/api/schedule/`) are superuser-only; the frontend never calls them.
- **BUG-9** `UserSerializer` no longer includes `password`.
- **BUG-10** Un-approving is audited as `unapproved`.
- `/api/schedule/` previously always returned 500 (serializer shadowed by the model name); fixed.

### Dock Restriction is Frontend-Only
The redirect of Dock users away from `/PendingRequests` happens in `PendingRequests.jsx`
(frontend only). There is no backend API restriction on `/api/request/` — Dock users can
query and modify appointments like Dispatch. (The `/api/audit/*` endpoints *are* restricted
server-side: Dock gets 403.) E2E test `test_dock_direct_navigate_to_pending_requests_redirects`
verifies the frontend behavior.

---

## Coverage Targets

| Area | Target |
|------|--------|
| `members/views.py` | ≥ 80% line coverage |
| `members/models.py` | ≥ 80% line coverage |
| `src/components/**` | ≥ 60% (complex components tested via E2E) |
| `src/utils/**` | 100% |

View backend coverage report: `backend/htmlcov/index.html` (generated by `make test`)
View frontend coverage report: `frontend/coverage/index.html` (generated by `npm run test:coverage`)

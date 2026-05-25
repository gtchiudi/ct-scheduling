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
| `backend/members/tests/test_request_crud.py` | Create/list/filter/delete appointments | 8 |
| `backend/members/tests/test_business_logic.py` | All branches in `RequestView.update()` | 20 |
| `backend/members/tests/test_warehouse_customer.py` | Warehouse and Customer CRUD + search | 7 |
| `backend/members/tests/test_utility_views.py` | `UserGroupsView` and `PendingRequestStatsView` | 7 |

**Total: 60 backend tests**

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
| `frontend/src/__tests__/components/FormActions.test.jsx` | Button rendering per path/workflow state | 16 |
| `frontend/src/__tests__/components/HeaderBar.test.jsx` | Nav links per auth state and user group | 18 |

**Total: 48 frontend tests**

---

## E2E Tests

### Prerequisites

1. **Install Playwright browser:**
   ```bash
   pip install playwright
   playwright install chromium
   ```

2. **The app must be running.** For local testing:
   ```bash
   cd backend && python manage.py runserver
   # (in another terminal)
   cd frontend && npm run dev
   ```
   Or use Docker Compose: `docker-compose up`

3. **Seed test users.** E2E tests require two users with known credentials:
   - **Dispatch user:** `e2e_dispatch` / `E2eDispatch123!` (in Dispatch group)
   - **Dock user:** `e2e_dock` / `E2eDock123!` (in Dock group)

   The `seed_test_data` fixture in `e2e/conftest.py` attempts this automatically via
   a `POST /api/e2e-seed/` endpoint (if implemented), or you can create them manually:
   ```bash
   cd backend
   python manage.py shell -c "
   from django.contrib.auth.models import User, Group
   g_dispatch, _ = Group.objects.get_or_create(name='Dispatch')
   g_dock, _ = Group.objects.get_or_create(name='Dock')
   u1 = User.objects.create_user('e2e_dispatch', password='E2eDispatch123!')
   u1.groups.add(g_dispatch)
   u2 = User.objects.create_user('e2e_dock', password='E2eDock123!')
   u2.groups.add(g_dock)
   "
   ```

### Run

```bash
make test-e2e                                              # local (http://localhost:8000)
make test-e2e E2E_BASE_URL=https://staging.example.com    # staging
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:8000` | Target app URL |
| `E2E_HEADLESS` | `true` | Run browsers headlessly |
| `E2E_BROWSER` | `chromium` | Browser (`chromium`, `firefox`, `webkit`) |
| `E2E_SLOW_MO` | `0` | Millisecond delay between actions (for debugging) |
| `E2E_DISPATCH_USER` | `e2e_dispatch` | Dispatch test user username |
| `E2E_DISPATCH_PASS` | `E2eDispatch123!` | Dispatch test user password |
| `E2E_DOCK_USER` | `e2e_dock` | Dock test user username |
| `E2E_DOCK_PASS` | `E2eDock123!` | Dock test user password |

### File Index

| File | What It Tests | Tests |
|------|---------------|-------|
| `e2e/tests/test_anonymous_flow.py` | Public form submission, login link visibility | 5 |
| `e2e/tests/test_dispatch_flow.py` | Approve/decline requests, calendar, logout | 8 |
| `e2e/tests/test_dock_flow.py` | Calendar access, no pending requests link, redirect | 4 |

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

### `IsAuthenticatedOrPostOnly` Bug
`backend/members/views.py`, line 48: `return IsAuthenticated` returns the **class object**,
not an instance. The `has_permission` method is never called for non-POST requests to
`/api/request/`. Anonymous GET requests pass the class-level check; they are blocked only
by the explicit `if not request.user.is_authenticated` guard inside `update()`.

Documented in: `test_permissions.py::test_anonymous_cannot_patch_request`

### Dock Restriction is Frontend-Only
The redirect of Dock users away from `/PendingRequests` happens in `PendingRequests.jsx`
(frontend only). There is no backend API restriction — Dock users can query all endpoints
that require `IsAuthenticated`. E2E test `test_dock_direct_navigate_to_pending_requests_redirects`
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

# Manual Test Plan: Appointment Audit Trail

Step-by-step checks for QA or a dispatcher. Each case lists preconditions, steps,
and expected results. Tick the box when a case passes. If a result differs, write down
the appointment reference, the time, and a screenshot.

Automated coverage for the same behaviour is in
`backend/members/tests/test_audit_acceptance.py` and `e2e/tests/test_audit_trail.py`.
This plan covers what is best checked by a person: how the screens read, real email and SMS,
and deployment.

---

## 0. Setup

### 0.1 Local environment

1. Apply migrations to the local database:
   ```bash
   cd backend && python manage.py migrate
   ```
   Expected: `0021_audit_fields_appointmentevent`, `0022_import_approvallog_events` and
   `0023_notificationlog` are applied, with no errors.
2. Start the backend with the E2E settings overlay. It turns on DEBUG and prints emails to the
   terminal instead of sending them:
   ```bash
   cd backend && PYTHONPATH=../e2e DJANGO_SETTINGS_MODULE=e2e_django_settings \
       python manage.py runserver 8000
   ```
3. Start the frontend: `cd frontend && npm run dev`, then open http://localhost:5173.
4. Create the test users (or run `make test-e2e` once, which seeds them through `/api/e2e-seed/`):

   | Role | Username | How |
   |------|----------|-----|
   | Dispatch | `e2e_dispatch` | seed endpoint |
   | Dock | `e2e_dock` | seed endpoint |
   | Admin group | `qa_admin` | Django admin: new user, add to group `Admin` |
   | Superuser | `qa_super` | `python manage.py createsuperuser` |
   | No group | `qa_nobody` | Django admin: new user with no groups |

5. Give `e2e_dispatch` a first and last name in Django admin (for example "Dana Smith"). The
   audit trail shows the full name when there is one and the username otherwise.

### 0.2 Conventions

- "Appointment window" means the dialog that opens when you click an event on the Calendar.
- "Activity history" is the section at the bottom of that window.
- "Audit Log" is the page at `/AuditLog`, reached from the header link.
- Times on screen are local time in `MM/DD/YYYY hh:mm AM/PM` format.

---

## 1. Capturing actions

For every case, open the appointment's Activity history afterwards. Unless the case says
otherwise, the newest entry is at the top and shows the time, who did it, and what happened.

### 1.1 Created from the public request form (anonymous)
- [ ] **Precondition:** logged out.
- **Steps:** Go to `/RequestForm`. Submit a request for company "QA Public Co" with reference
  `QA-PUB-1`. Log in as `e2e_dispatch`, open **Pending Requests**, then open the request.
- **Expected:** the Audit Log (**Appointment activity** tab, filter Action = Created) has a row
  for `QA-PUB-1` with Person **"Request form"**. In Django admin, the request's **Created by**
  is empty and **Created at** is set.

### 1.2 Created from the Calendar (staff)
- [ ] **Steps:** As `e2e_dispatch`, click an empty Calendar slot. Create "QA Cal Co" with
  reference `QA-CAL-1`.
- **Expected:** Activity history shows **Created** by Dana Smith. Created by = Dana Smith in
  admin. A **"Email sent: Calendar event"** entry also appears.

### 1.3 Approved
- [ ] **Steps:** Open **Pending Requests**, open `QA-PUB-1`, and click **Approve**.
- **Expected:** Activity history has **Approved** by Dana Smith above **Created** by "Request
  form", plus **"Email sent: Approval"** to the requester's address.

### 1.4 Declined
- [ ] **Steps:** Submit another public request (`QA-DEC-1`). In Pending Requests, click
  **Decline** and confirm.
- **Expected:** Audit Log has a **Declined** row by Dana Smith, and the Notifications tab has a
  **Decline** email to the requester. (Declined requests leave the calendar, so check this in
  the Audit Log.)

### 1.5 Edited (field-level before and after)
- [ ] **Steps:** Open `QA-CAL-1`, click **Edit Appointment**, change the **Carrier Name**, the
  **date/time** and the **Warehouse**, then click **Save Changes**. Reopen the appointment.
- **Expected:** one **Edited** entry by Dana Smith, listing each changed field once:
  - `Carrier name: QA Cal Co → <new name>`
  - `Appointment date and time: <old> → <new>` (both shown as readable local times)
  - `Warehouse: <old warehouse name> → <new warehouse name>` (names, not IDs)

  Fields you did not change are not listed.

### 1.6 Checked in
- [ ] **Steps:** Open `QA-CAL-1`, enter a driver phone number, and click **Check-In**.
- **Expected:** **Checked in** by Dana Smith. If the phone number or SMS consent changed, an
  **Edited** entry lists only those fields. "Checked in" never appears as a field change.

### 1.7 Docked
- [ ] **Steps:** Reopen `QA-CAL-1`, enter Dock Number 5, click **Send To Dock**, then **OK** on
  the SMS warning if it appears.
- **Expected:** **Docked** by Dana Smith and `Dock number: (empty) → 5`. If the driver gave SMS
  consent, there is also **"SMS sent: Dock ready"** to the driver's number.

### 1.8 Completed
- [ ] **Steps:** Reopen the appointment, tick **Paperwork Scanned**, and click **Complete**.
- **Expected:** **Completed** by Dana Smith. Reading bottom to top, the history is Created →
  (Edited) → Checked in → Docked → Completed.

### 1.9 Cancelled (Cancel Appointment button)
- [ ] **Steps:** Create `QA-CAN-1` on the Calendar and open it. Click **Edit Appointment**
  (the Cancel button only appears in edit mode, before check-in), then **Cancel Appointment**,
  and confirm with **Cancel Appointment** in the "Are you sure" dialog.
- **Expected:** Audit Log has a **Cancelled** row by Dana Smith and a **Cancellation** email to
  the requester (if the appointment has an email).

### 1.10 Remove from Calendar (completed appointment)
- [ ] **Steps:** Open a completed appointment (Check-In → Send To Dock → Complete) and click
  **Remove from Calendar**.
- **Expected:** the event disappears from the calendar. The Audit Log (Action = **Removed from
  calendar**) has a row by you with an empty Details column. The Notifications tab has **no**
  Decline (or any other) email for this appointment. The UI calls
  `POST /api/request/<id>/remove/`.
- [ ] **Decline still works for pending requests:** declining in Pending Requests (1.4) still
  records **Declined** and sends the Decline email.
- [ ] **API:** a `PUT` that sets `active: false` on an *approved* appointment is also recorded as
  **Removed from calendar**, with no email. `DELETE /api/request/<id>/` (scripts and tests only)
  records **Cancelled** with an empty Details column.

---

## 2. No-op save

(Also repeat it once from a browser set to another time zone, for example US Central.
Since the BUG-5 fix, it must not record an Edited date either.)

- [ ] **Steps:** Open any approved appointment, click **Edit Appointment**, change nothing, and
  click **Save Changes**. Repeat once.
- **Expected:** no new entry in Activity history, and the Audit Log row count for that
  appointment is unchanged.
- [ ] **Variant:** Type into an empty optional field (for example Trailer Number), delete what
  you typed, and save. **Expected:** no Edited entry (empty and blank count as the same value).

---

## 3. Anonymous form attribution

- [ ] In the Audit Log, set Person = **"Request form / unknown"**.
- **Expected:** only rows created through the public form (Action = Created, Person =
  "Request form") and any imported rows without an actor. No staff names appear.
- [ ] In the Notifications tab for a public request, both the **New request** email (to the
  Candor mailbox) and the **Request confirmation** email (to the requester) are listed.

---

## 4. Notifications: sent and failed

### 4.1 Sent
- [ ] Using the console email backend (setup 0.1), approve a request.
- **Expected:** the email body prints in the backend terminal. Notifications tab shows
  Channel **Email**, Type **Approval**, Status **Sent**, the recipient, and the subject
  `Appointment Request Approved - #<first ref>`.

### 4.2 Simulate a failed email
1. Stop the backend and restart it with `E2E_EMAIL_FAIL=1`. This points SMTP at a closed local
   port, so every send fails:
   ```bash
   cd backend && E2E_EMAIL_FAIL=1 PYTHONPATH=../e2e DJANGO_SETTINGS_MODULE=e2e_django_settings \
       python manage.py runserver 8000
   ```
   Do **not** use "real SMTP with no `SMTP_API_KEY`": in testing, smtp.gmail.com accepted the
   message without login, so the rows came out **Sent** and real mail may have gone out.
2. - [ ] Submit a public request.
- **Expected:** the request is still created (success dialog shown). The Notifications tab shows
  two rows (Types **New request** and **Request confirmation**) with Status **Failed** (red
  chip) and the error `[Errno 61] Connection refused` (the number varies by OS). In Activity
  history they read "Email failed: …" with the error underneath.
3. Restart with the default console backend before continuing.

### 4.3 Simulate a failed SMS
Option A, Twilio test credentials (no charge):
1. Export Twilio **test** credentials: `TWILIO_ACCOUNT_SID=<test SID>`,
   `TWILIO_AUTH_TOKEN=<test token>`, `TWILIO_PHONE_NUMBER=+15005550006`.
2. - [ ] Check in an appointment with driver phone `+15005550001` (Twilio's "invalid number"
   magic number) and SMS consent ticked.
- **Expected:** the screen shows the Twilio error. Notifications tab shows Channel **SMS**,
  Type **SMS subscribed**, Status **Failed**, and the Twilio error text.

Option B, no Twilio credentials: leave the `TWILIO_*` variables unset. Check in an appointment
with a new driver phone number and SMS consent ticked.
- **Expected:** the app shows the warning "SMS notification failed: HTTP 400 error: Unable to
  create record: …". The check-in itself is still saved: Activity history shows **Checked in**
  and an **Edited** entry for the phone and consent. The Notifications tab shows Channel **SMS**,
  Type **SMS subscribed**, Status **Failed**, and the Twilio error. (Without credentials the
  Twilio client still calls Twilio's API and gets a REST error, so this needs network access.)

### 4.4 Emails not tied to an appointment
- [ ] Filter the Notifications tab by Type. Rows without an appointment show "—" in the
  Appointment column and do not break the table.

---

## 5. Activity history (appointment window)

- [ ] **Loading:** open an appointment on a throttled network (DevTools, "Slow 3G").
  **Expected:** "Loading activity..." with a spinner, then the list.
- [ ] **Empty state:** open an appointment that was created directly on the Calendar *before*
  this release. Calendar-created appointments never had an ApprovalLog row, so nothing was
  imported for them. **Expected:** "No activity recorded yet."
- [ ] **Mixed timeline:** actions and emails/texts are interleaved, newest first. Each row shows
  the date/time, then the actor (for actions) or the recipient (for notifications), then the
  description.
- [ ] **Date unknown:** for an appointment approved before this release, the imported approval
  shows **"date unknown"** and sits at the bottom of the list.
- [ ] **Role:** as `e2e_dock`, open any appointment. **Expected:** no Activity history section.

---

## 6. Audit Log search

Open **Audit Log** from the header as `e2e_dispatch`.

### 6.1 Appointment activity filters
- [ ] **Person:** choose Dana Smith. Every row's Person is Dana Smith.
- [ ] **Action (multi-select):** choose Approved and Cancelled. Only those two actions appear.
  Clear the filter and all actions return.
- [ ] **Warehouse:** choose one warehouse. Every row's Warehouse column matches.
- [ ] **Date range:** set From = To = today. Only today's rows appear. The range includes the
  whole day in Eastern time, so an action at 11:30 PM Eastern appears under that date, not the
  next day.
- [ ] **Combined:** Person + Action + From/To together narrow the results as expected.
- [ ] **No results:** pick a date range with no activity. **Expected:** "No activity matches
  these filters."

### 6.2 Notifications filters
- [ ] **Channel** (Email/SMS), **Type** (multi-select), **Status** (Sent/Failed),
  **Warehouse**, **From/To**: each narrows the rows to matching values.
- [ ] **Recipient:** type part of an address, in any capitalisation (for example `ACME`). The
  table updates after a short pause and shows only matching recipients.

### 6.3 Paging
- [ ] With more than 50 rows, the footer shows "1–50 of N". Next/Previous page through the
  results without duplicates or gaps.
- [ ] Change **Rows per page** to 25 and then 100; the counts update.
- [ ] While on page 2, change any filter. **Expected:** the table returns to page 1.

### 6.4 CSV export
- [ ] Apply filters (for example Action = Edited, a date range), then click **Export CSV**.
  **Expected:** a `.csv` file downloads, named `appointment-activity-YYYYMMDD-HHMMSS.csv`
  or `notifications-YYYYMMDD-HHMMSS.csv` (server time, Eastern).
- [ ] Open it. The columns are:
  - Activity: `occurred_at, action, actor_name, appointment_ref, appointment_company,
    warehouse_name, changes, appointment`
  - Notifications: `sent_at, channel, kind, status, recipient, subject, error,
    appointment_ref, appointment_company, warehouse_name, appointment`
- [ ] The row count equals the **total** shown in the table footer (N), not just the current
  page.
- [ ] Every row matches the filters. `changes` is JSON (for example
  `{"date_time": ["…", "…"]}`).
- [ ] Export with no filters downloads everything.

---

## 7. Role access

| # | User | Header link "Audit Log" | Visit `/AuditLog` | Activity history in appointment window | `GET /api/audit/events/` |
|---|------|------------------------|-------------------|----------------------------------------|--------------------------|
| 7.1 | logged out | hidden | sent to login | n/a | **401** |
| 7.2 | `e2e_dock` | hidden | redirected to `/Calendar` | hidden | **403** |
| 7.3 | `qa_nobody` (no group) | n/a | logged out, sent to login* | n/a | **403** |
| 7.4 | `e2e_dispatch` | shown | page loads | shown | **200** |
| 7.5 | `qa_admin` (Admin group) | shown | page loads | shown | **200** |
| 7.6 | `qa_super` (superuser, no groups) | n/a | logged out, sent to login* | n/a | **200** |

\* The web app logs out any user whose `/api/user-groups/` list is empty (`atoms.jsx`,
`fetchAndSetUserGroups`), so users with no groups never reach the Audit Log page. A superuser
still gets 200 from the audit API. To use the page, a superuser must also be in Admin or
Dispatch.

To check the API column, get a token and call the endpoint:
```bash
TOKEN=$(curl -s -X POST localhost:8000/token/ -H 'Content-Type: application/json' \
  -d '{"username":"e2e_dock","password":"TestE2eD0ck123!"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access"])')
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" localhost:8000/api/audit/events/
```
Repeat for `/api/audit/notifications/`, `/api/audit/actors/` and
`/api/audit/timeline/?appointment=<id>`.

- [ ] `GET /api/audit/timeline/` without `?appointment=` returns **400** for Dispatch.

**Appointment API (`/api/request/`), logged out** (BUG-1 fix):

| Call | Logged out | Logged in (any group) |
|------|-----------|------------------------|
| `POST /api/request/` (public form submit) | **201** | 201 |
| `GET /api/request/slots/?start_date=&end_date=[&warehouse=]` | **200**, each row has only `warehouse`, `date_time`, `appointment_length` | 200 |
| `GET /api/request/slots/` without dates | **400** | 400 |
| `GET /api/request/`, `GET /api/request/<id>/` | **401** | 200 |
| `PUT` / `PATCH` / `DELETE /api/request/<id>/` | **401** | 200 / 204 |
| `POST /api/request/<id>/remove/` | **401** | 200 (sets inactive, audits **Removed from calendar**, no email) |

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/api/request/                       # 401
curl -s "localhost:8000/api/request/slots/?start_date=2026-10-01&end_date=2026-10-02"     # 200, 3 fields per row
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/request/<id>/remove/   # 401
```
- [ ] Logged out, the public request form still works: choosing a warehouse jumps to the first
  open slot, and booked times are not offered in the time picker.

**Other endpoints, still open (see section 10, BUG-7 to BUG-9):** `/api/warehouse/` accepts
anonymous writes, and `/api/user/` lets any logged-in user read password hashes and change
groups. Check whether these are fixed.
- [ ] `POST`/`DELETE` to any `/api/audit/` endpoint is rejected (405 or 403).
- [ ] Django admin: **Appointment events** and **Notification logs** are listed, can be viewed,
  and cannot be added, changed or deleted.

---

## 8. Retention command

Run these on a local copy of the database, never production.

### 8.1 Retention not configured (the default)
- [ ] `cd backend && python manage.py prune_audit_logs --dry-run`
- **Expected:** "No retention configured … keeping all" for both events and notifications.
  Nothing is deleted.

### 8.2 Dry run
1. Age some rows in `python manage.py shell`:
   ```python
   from datetime import timedelta
   from django.utils import timezone
   from members.models import AppointmentEvent, NotificationLog
   old = timezone.now() - timedelta(days=400)
   AppointmentEvent.objects.filter(occurred_at__isnull=False).order_by('occurred_at')[:3]  # note the ids
   AppointmentEvent.objects.filter(id__in=[...]).update(occurred_at=old)
   NotificationLog.objects.filter(id__in=[...]).update(sent_at=old)
   ```
2. - [ ] `python manage.py prune_audit_logs --days 365 --dry-run`
- **Expected:** "Would delete 3 appointment events …" (and the notification count). The counts
  in the shell are unchanged afterwards.

### 8.3 Real run
- [ ] `python manage.py prune_audit_logs --days 365`
- **Expected:** "Deleted …" with the same counts. The aged rows are gone and newer rows remain.
- [ ] Imported approvals (`occurred_at` empty, "date unknown") are **not** deleted, even with
  `--days 1`.
- [ ] `AUDIT_RETENTION_DAYS=365 python manage.py prune_audit_logs --dry-run` uses 365 for both.
  Adding `NOTIFICATION_RETENTION_DAYS=30` changes the cutoff for notifications only.
- [ ] `--days 0` is rejected: `CommandError: --days must be at least 1.`
- [ ] `AUDIT_RETENTION_DAYS=0`, a negative value, or a non-numeric value (for example `365d`)
  is ignored with a warning ("… is not a positive … number of days; ignoring it"), and
  everything is kept. The app and `manage.py` still start (BUG-4, fixed).

---

## 9. Migration and import of old approvals

Use a copy of production-like data that has `ApprovalLog` rows.

1. - [ ] Before migrating, count approvals: `ApprovalLog.objects.count()` → N.
2. - [ ] `python manage.py migrate`
3. **Expected:**
   - [ ] `AppointmentEvent.objects.filter(action='approved', occurred_at__isnull=True).count()`
     equals N.
   - [ ] Each imported event's actor is the original approver (empty if that user was deleted).
   - [ ] Existing requests have empty `created_by`, `created_at` and `updated_at`. The app loads
     and lists them normally.
   - [ ] In the app, an old approved appointment's Activity history shows **Approved**,
     **"date unknown"**, by the original approver, at the bottom of the list.
   - [ ] In the Audit Log, imported rows appear **after** all dated rows (newest first, unknown
     dates last) and show "date unknown".
4. - [ ] Rollback check (local only): `python manage.py migrate members 0020` completes without
   errors. Then re-apply with `migrate`.

---

## 10. Issues found during QA

### 10.1 Fixed: verify on each release

| ID | Was | Fixed in | How to verify |
|----|-----|----------|---------------|
| BUG-1 | Anonymous users could read every appointment (emails, phones) and PUT/DELETE any of them through `/api/request/` | b09077f | Section 7 "Appointment API" table: logged out, everything except create and `/slots/` returns 401. The public form still greys out booked slots and picks the first available one. |
| BUG-2 | **Remove from Calendar** emailed the carrier "Request Declined" and was audited as **Declined** | b09077f | Section 1.10: **Removed from calendar** in the Audit Log, no Decline email. Declining a *pending* request still emails (1.4). |
| BUG-3 | Saving an appointment with a sub-second stored time recorded an Edited date "X → X" | 87bda44 | Approve the seeded `E2E-PENDING-001` (its time has microseconds). There should be no Edited entry. |
| BUG-4 | Retention env ≤ 0 wiped the trail; non-numeric crashed settings | 87bda44 | Section 8: `AUDIT_RETENTION_DAYS=0` or `=abc` with `prune_audit_logs --dry-run` prints a warning and keeps everything. |
| BUG-5 | From a non-Eastern browser, an unchanged save (and approve/check-in) moved the appointment by the UTC-offset difference | b09077f | In Chrome DevTools, open **Sensors → Location**, choose *Other…*, and set **Timezone ID** to `America/Chicago` (then reload), or run the E2E tests. (1) Open an appointment, click **Edit Appointment** then **Save Changes**; the time is unchanged and no Edited entry appears. (2) Create an appointment from the Calendar; the stored time equals the picker's value (warehouse time). (3) Approve a pending request; its time is unchanged. |
| BUG-6 | Superuser could not delete a Request/Warehouse with audit events in Django admin | 87bda44 | Django admin: delete a test Request that has activity. The confirmation page lists the audit rows and allows the delete. |

Automated: `backend/members/tests/test_audit_acceptance.py` (section 10) and
`e2e/tests/test_request_fixes.py`, `e2e/tests/test_audit_trail.py::test_bug_noop_save_from_central_time_browser_keeps_date`.

### 10.2 Open (tracked as `xfail(strict=True)`; remove the marker with the fix)

| ID | Severity | What happens | Test |
|----|----------|--------------|------|
| BUG-7 | High (pre-existing) | `WarehouseView` has no permission class, and there is no default, so **anonymous** users can create, rename, re-timezone and soft-delete warehouses. The public form only needs `GET`. | `test_audit_acceptance.py::test_bug_anonymous_cannot_modify_warehouses` |
| BUG-8 | High (pre-existing) | `UserView` allows any logged-in user (even Dock) to `PATCH /api/user/<own id>/ {"groups": [<Admin id>]}` and become Admin, gaining the Audit Log | `…::test_bug_dock_user_cannot_grant_itself_audit_access` |
| BUG-9 | High (pre-existing) | `GET /api/user/` returns every user's password hash to any logged-in user | `…::test_bug_user_api_does_not_expose_password_hashes` |
| BUG-10 | Low (audit gap) | Un-approving (`PUT approved: false`, API only) records nothing. A later `active: false` then counts as a **decline** and emails the carrier | `…::test_bug_unapprove_is_audited` |

Also noted, not a bug: the public request form calls `GET /api/customer/` while logged out and
gets 401 (harmless console noise).

---

## 11. Deployment checklist

### Pre-deploy
- [ ] `make test` (backend) and `make test-frontend` are green.
- [ ] `make test-e2e` against a local or staging instance is green, including
  `e2e/tests/test_audit_trail.py`.
- [ ] `python manage.py makemigrations --check --dry-run` reports no changes.
- [ ] `kubectl diff -k deployments/production` shows the new CronJob `prune-audit-logs`
  (schedule `30 2 * * *`, timeZone `America/New_York`), its production env patch, and no
  unexpected changes.
- [ ] Decide on retention. To keep everything, leave `AUDIT_RETENTION_DAYS` /
  `NOTIFICATION_RETENTION_DAYS` out of `ctscheduling-env-secret`, since they are optional.
  Otherwise add them to the secret before deploying.
- [ ] Back up the production database. The migration adds three columns to the request table,
  two new tables, and one data import.

### Deploy
- [ ] Deploy as usual (`make build`, `make diff`, `make deploy`). The container entrypoint runs
  `python manage.py migrate --noinput` on start.
- [ ] Watch the pod logs (`make logs`) for `Applying members.0021…0023 … OK`.

### Post-deploy
- [ ] `make migrate` (or `make django-shell` → `showmigrations members`) shows 0021–0023 as
  applied.
- [ ] `kubectl -n ctscheduling get cronjob prune-audit-logs` exists, with the correct schedule
  and time zone.
- [ ] Optional: `kubectl -n ctscheduling create job --from=cronjob/prune-audit-logs prune-smoke`
  completes, and its log says "keeping all" (or shows the expected counts if retention is set).
  Delete the job afterwards.
- [ ] **Smoke test** (production, as a Dispatch user, about 5 minutes):
  1. The **Audit Log** link is in the header and the page loads both tabs.
  2. Open an existing approved appointment. Activity history shows at least the imported
     "Approved · date unknown" entry.
  3. Make a harmless edit to a test appointment (for example a note) and save. Reopen it:
     **Edited** by you, with before → after.
  4. The Notifications tab shows today's emails with Status **Sent**. Investigate any unexpected
     **Failed** rows (SMTP or Twilio credentials).
  5. Export CSV from the Audit Log with a one-day date range. The file downloads and opens.
  6. Log in as a Dock user. There is no Audit Log link, and `/AuditLog` redirects to the
     Calendar.

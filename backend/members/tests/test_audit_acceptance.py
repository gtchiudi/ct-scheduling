"""
Acceptance tests for the Appointment Audit Trail (black-box).

Written only from the shared contract (audit-contract.md): drive the app through
HTTP with the DRF APIClient, then read the AppointmentEvent / NotificationLog
tables and the /api/audit/* endpoints. Nothing here imports the audit
implementation.

Journeys covered:
  - Public create -> approve -> edit date -> check in -> dock -> complete:
    ordered events, actors, field-level changes, notifications (email + SMS)
  - Calendar create by Dispatch (created_by / actor set)
  - Cancel (cancelled_time), soft delete (DELETE), decline
  - No-op save produces no event
  - Failed email / failed SMS recorded as status=failed
  - Permissions matrix on all four /api/audit/ endpoints
  - Event + notification filters, paging, ordering, CSV export matching filters
  - Timeline merge and "date unknown" (null occurred_at) imported approvals
  - Actors list

Notification rows need the real send_email/send_text to run, so these tests do
NOT use the mock_email / mock_sms fixtures (they patch members.views.* and would
bypass the logging). Email uses pytest-django's locmem backend; Twilio is
patched at the transport (members.messages.Client).
"""

import csv
import io
import uuid
from datetime import datetime, timedelta
from unittest import mock

import pytest
import pytz
from django.apps import apps
from django.contrib.auth.models import Group, User
from django.core import mail
from django.utils import timezone

from members.models import Request, SmsNumberLog, Warehouse
from members.tests.conftest import _make_authed_client

NY = pytz.timezone("America/New_York")

EVENTS_URL = "/api/audit/events/"
NOTIFICATIONS_URL = "/api/audit/notifications/"
TIMELINE_URL = "/api/audit/timeline/"
ACTORS_URL = "/api/audit/actors/"

EVENT_CSV_COLUMNS = [
    "occurred_at", "action", "actor_name", "appointment_ref", "appointment_company",
    "warehouse_name", "changes", "appointment",
]
NOTIFICATION_CSV_COLUMNS = [
    "sent_at", "channel", "kind", "status", "recipient", "subject", "error",
    "appointment_ref", "appointment_company", "warehouse_name", "appointment",
]


# ---------------------------------------------------------------------------
# Model access (resolved lazily so each test fails on its own until the
# backend lands, instead of one import error for the whole module)
# ---------------------------------------------------------------------------

def Event():
    return apps.get_model("members", "AppointmentEvent")


def Notification():
    return apps.get_model("members", "NotificationLog")


def _events(appt_id):
    """Events for one appointment, oldest first."""
    return list(Event().objects.filter(appointment_id=appt_id).order_by("occurred_at"))


def _notifications(appt_id):
    return list(Notification().objects.filter(appointment_id=appt_id).order_by("sent_at"))


def _parse_dt(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _group(name):
    return Group.objects.get_or_create(name=name)[0]


@pytest.fixture
def dana(db):
    """Dispatch user with a full name, so actor_name is predictable."""
    user = User.objects.create_user(
        username="dana", password="pw-123456", first_name="Dana", last_name="Smith"
    )
    user.groups.add(_group("Dispatch"))
    return user


@pytest.fixture
def dana_client(dana):
    return _make_authed_client(dana)


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="root_audit", password="pw-123456")


@pytest.fixture
def superuser_client(superuser):
    return _make_authed_client(superuser)


@pytest.fixture
def second_warehouse(db):
    return Warehouse.objects.create(
        id=uuid.uuid4(), name="Second Warehouse", address="9 Other Rd",
        phone_number="5550000000", timezone="America/New_York",
    )


@pytest.fixture
def twilio(mocker):
    """Patch the Twilio client at the transport used by members.messages."""
    client_cls = mocker.patch("members.messages.Client")
    client_cls.return_value.messages.create.return_value = mock.Mock(sid="SM123")
    return client_cls


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

READ_ONLY_KEYS = {"id", "customer", "created_by", "created_by_name", "created_at", "updated_at"}


def _put(client, appt_id, **overrides):
    """GET the appointment and PUT it back with overrides, the way the UI does."""
    got = client.get(f"/api/request/{appt_id}/")
    assert got.status_code == 200, got.content
    body = {k: v for k, v in got.json().items() if k not in READ_ONLY_KEYS}
    customer = got.json().get("customer")
    body["customer_id"] = customer["id"] if customer else None
    body.update(overrides)
    resp = client.put(f"/api/request/{appt_id}/", body, format="json")
    assert resp.status_code == 200, resp.content
    return resp.json()


def _public_create(api_client, warehouse, **overrides):
    payload = {
        "approved": False,
        "company_name": "Journey Freight",
        "email": "driver@journey.test",
        "warehouse": str(warehouse.id),
        "ref_number": "JRN-1;JRN-2",
        "load_type": "Full",
        "date_time": _iso(timezone.now() + timedelta(days=5)),
        "delivery": True,
    }
    payload.update(overrides)
    resp = api_client.post("/api/request/", payload, format="json")
    assert resp.status_code == 201, resp.content
    return resp.json()


def _make_request(warehouse, company="ORM Co", ref="ORM-1", approved=True):
    """Create a Request directly in the DB (no view => no audit capture)."""
    return Request.objects.create(
        id=uuid.uuid4(), approved=approved, active=True, company_name=company,
        email=f"{company.replace(' ', '').lower()}@example.com", warehouse=warehouse,
        ref_number=ref, load_type="Full", date_time=timezone.now() + timedelta(days=3),
        delivery=True,
    )


def _ny(y, m, d, hh=12, mm=0):
    return NY.localize(datetime(y, m, d, hh, mm))


def _csv_rows(response):
    content = b"".join(response.streaming_content) if getattr(response, "streaming", False) \
        else response.content
    reader = csv.reader(io.StringIO(content.decode("utf-8-sig")))
    rows = list(reader)
    return rows[0], rows[1:]


# ===========================================================================
# 1. End-to-end journey: public create -> approve -> edit -> check in -> dock -> complete
# ===========================================================================

@pytest.mark.django_db
def test_full_lifecycle_journey(api_client, dana, dana_client, warehouse, twilio):
    created = _public_create(api_client, warehouse)
    appt_id = created["id"]
    Event_, Notif = Event(), Notification()

    # -- created (anonymous) --------------------------------------------------
    appt = Request.objects.get(id=appt_id)
    assert appt.created_by is None
    assert appt.created_at is not None
    evs = _events(appt_id)
    assert [e.action for e in evs] == ["created"]
    assert evs[0].actor is None
    assert evs[0].occurred_at is not None
    notes = _notifications(appt_id)
    assert sorted(n.kind for n in notes) == ["new_request", "request_confirmation"]
    assert all(n.channel == "email" and n.status == "sent" for n in notes)
    assert "driver@journey.test" in {n.recipient for n in notes}

    # -- approved ---------------------------------------------------------------
    _put(dana_client, appt_id, approved=True)
    evs = _events(appt_id)
    assert [e.action for e in evs] == ["created", "approved"]
    assert evs[-1].actor == dana
    approval = [n for n in _notifications(appt_id) if n.kind == "approval"]
    assert len(approval) == 1
    assert approval[0].recipient == "driver@journey.test"
    assert approval[0].status == "sent"
    assert "JRN-1" in approval[0].subject

    # -- edit the date -----------------------------------------------------------
    old_dt = Request.objects.get(id=appt_id).date_time
    new_dt = old_dt + timedelta(days=1, hours=5)
    _put(dana_client, appt_id, date_time=_iso(new_dt))
    evs = _events(appt_id)
    assert [e.action for e in evs] == ["created", "approved", "edited"]
    edit = evs[-1]
    assert edit.actor == dana
    assert set(edit.changes) == {"date_time"}
    before, after = edit.changes["date_time"]
    assert _parse_dt(before) == old_dt
    assert _parse_dt(after) == new_dt
    notes_before_checkin = len(_notifications(appt_id))

    # -- check in (driver phone given with SMS consent) --------------------------
    _put(
        dana_client, appt_id,
        check_in_time=_iso(timezone.now()),
        driver_phone_number="+15555550009",
        sms_consent=True,
    )
    step = _events(appt_id)[3:]
    assert "checked_in" in [e.action for e in step]
    for e in step:
        assert e.actor == dana
        if e.action == "edited":
            # check_in_time itself is consumed by checked_in, never an edit
            assert "check_in_time" not in e.changes
            assert set(e.changes) <= {"driver_phone_number", "sms_consent"}
    subscribed = [n for n in _notifications(appt_id) if n.kind == "sms_subscribed"]
    assert len(subscribed) == 1
    assert subscribed[0].channel == "sms"
    assert subscribed[0].recipient == "+15555550009"
    assert subscribed[0].status == "sent"
    assert SmsNumberLog.objects.filter(sms_number="+15555550009", consent=True).exists()
    assert len(_notifications(appt_id)) == notes_before_checkin + 1

    # -- dock ---------------------------------------------------------------------
    n_events = len(_events(appt_id))
    _put(dana_client, appt_id, dock_number=5, docked_time=_iso(timezone.now()))
    step = _events(appt_id)[n_events:]
    assert "docked" in [e.action for e in step]
    for e in step:
        if e.action == "edited":
            assert "docked_time" not in e.changes
            assert e.changes == {"dock_number": [None, 5]}
    dock_sms = [n for n in _notifications(appt_id) if n.kind == "dock_ready"]
    assert len(dock_sms) == 1
    assert dock_sms[0].channel == "sms"
    assert dock_sms[0].status == "sent"

    # -- complete -----------------------------------------------------------------
    n_events = len(_events(appt_id))
    _put(dana_client, appt_id, completed_time=_iso(timezone.now()))
    step = _events(appt_id)[n_events:]
    assert [e.action for e in step] == ["completed"]

    # -- overall ordering + API view ----------------------------------------------
    all_events = _events(appt_id)
    actions = [e.action for e in all_events]
    for earlier, later in [("created", "approved"), ("approved", "checked_in"),
                           ("checked_in", "docked"), ("docked", "completed")]:
        assert actions.index(earlier) < actions.index(later)
    times = [e.occurred_at for e in all_events]
    assert times == sorted(times)
    assert Event_.objects.filter(appointment_id=appt_id, action="cancelled").count() == 0

    resp = dana_client.get(EVENTS_URL, {"appointment": appt_id})
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == len(all_events)
    api_actions = [r["action"] for r in body["results"]]
    assert api_actions[0] == "completed"          # newest first
    assert api_actions[-1] == "created"
    created_row = body["results"][-1]
    assert created_row["actor"] is None
    assert created_row["actor_name"] == "Request form"
    assert created_row["appointment"] == appt_id
    assert created_row["appointment_ref"] == "JRN-1;JRN-2"
    assert created_row["appointment_company"] == "Journey Freight"
    assert created_row["warehouse"] == str(warehouse.id)
    assert created_row["warehouse_name"] == warehouse.name
    approved_row = next(r for r in body["results"] if r["action"] == "approved")
    assert approved_row["actor"] == dana.id
    assert approved_row["actor_name"] == "Dana Smith"
    edited_row = next(r for r in body["results"]
                      if r["action"] == "edited" and "date_time" in r["changes"])
    assert _parse_dt(edited_row["changes"]["date_time"][1]) == new_dt

    assert Notif.objects.filter(appointment_id=appt_id).count() == len(_notifications(appt_id))


@pytest.mark.django_db
def test_request_serializer_exposes_audit_fields(api_client, dana_client, dana, warehouse):
    public = _public_create(api_client, warehouse)
    got = dana_client.get(f"/api/request/{public['id']}/").json()
    for key in ("created_by", "created_by_name", "created_at", "updated_at"):
        assert key in got
    assert got["created_by"] is None
    assert got["created_at"] is not None

    resp = dana_client.post("/api/request/", {
        "approved": True, "company_name": "Calendar Co", "email": "cal@example.com",
        "warehouse": str(warehouse.id), "ref_number": "CAL-1", "load_type": "Full",
        "date_time": _iso(timezone.now() + timedelta(days=2)), "delivery": False,
    }, format="json")
    assert resp.status_code == 201
    assert resp.json()["created_by"] == dana.id
    assert resp.json()["created_by_name"] == "Dana Smith"


@pytest.mark.django_db
def test_created_by_read_only_cannot_be_spoofed(dana_client, dana, superuser, warehouse):
    resp = dana_client.post("/api/request/", {
        "approved": True, "company_name": "Spoof Co", "email": "s@example.com",
        "warehouse": str(warehouse.id), "ref_number": "SP-1", "load_type": "Full",
        "date_time": _iso(timezone.now() + timedelta(days=2)), "delivery": False,
        "created_by": superuser.id,
    }, format="json")
    assert resp.status_code == 201
    assert Request.objects.get(id=resp.json()["id"]).created_by == dana


@pytest.mark.django_db
def test_calendar_create_by_dispatch(dana_client, dana, warehouse):
    resp = dana_client.post("/api/request/", {
        "approved": True, "company_name": "Calendar Co", "email": "cal@example.com",
        "warehouse": str(warehouse.id), "ref_number": "CAL-1", "load_type": "Full",
        "date_time": _iso(timezone.now() + timedelta(days=2)), "delivery": False,
    }, format="json")
    assert resp.status_code == 201
    appt_id = resp.json()["id"]
    assert Request.objects.get(id=appt_id).created_by == dana
    created = [e for e in _events(appt_id) if e.action == "created"]
    assert len(created) == 1 and created[0].actor == dana
    kinds = [n.kind for n in _notifications(appt_id)]
    assert "calendar_event" in kinds


# ===========================================================================
# 2. Cancel, soft delete, decline
# ===========================================================================

@pytest.mark.django_db
def test_cancel_via_cancelled_time(dana_client, dana, approved_request):
    _put(dana_client, approved_request.id, cancelled_time=_iso(timezone.now()))
    evs = _events(approved_request.id)
    assert [e.action for e in evs] == ["cancelled"]
    assert evs[0].actor == dana
    assert "cancelled_time" not in evs[0].changes
    kinds = [(n.kind, n.recipient) for n in _notifications(approved_request.id)]
    assert ("cancellation", approved_request.email) in kinds


@pytest.mark.django_db
def test_soft_delete_records_cancelled(dana_client, dana, approved_request):
    resp = dana_client.delete(f"/api/request/{approved_request.id}/")
    assert resp.status_code in (200, 204)
    evs = _events(approved_request.id)
    assert [e.action for e in evs] == ["cancelled"]
    assert evs[0].actor == dana
    assert evs[0].changes == {}


@pytest.mark.django_db
def test_decline(dana_client, dana, pending_request):
    _put(dana_client, pending_request.id, active=False)
    evs = _events(pending_request.id)
    assert [e.action for e in evs] == ["declined"]
    assert evs[0].actor == dana
    kinds = [(n.kind, n.recipient) for n in _notifications(pending_request.id)]
    assert ("decline", pending_request.email) in kinds


# ===========================================================================
# 3. No-op save and edit shapes
# ===========================================================================

@pytest.mark.django_db
def test_noop_save_produces_no_event(dana_client, approved_request):
    _put(dana_client, approved_request.id)  # identical body
    _put(dana_client, approved_request.id)
    assert _events(approved_request.id) == []


@pytest.mark.django_db
def test_edit_records_only_changed_fields(dana_client, approved_request, second_warehouse, warehouse):
    _put(
        dana_client, approved_request.id,
        note_section="Call ahead", warehouse=str(second_warehouse.id),
    )
    evs = _events(approved_request.id)
    assert [e.action for e in evs] == ["edited"]
    changes = evs[0].changes
    assert set(changes) == {"note_section", "warehouse"}
    assert changes["warehouse"] == [warehouse.name, second_warehouse.name]
    assert changes["note_section"][1] == "Call ahead"
    assert changes["note_section"][0] in (None, "")


@pytest.mark.django_db
def test_customer_change_stored_as_display_name(dana_client, approved_request, customer_with_updates):
    _put(dana_client, approved_request.id, customer_id=str(customer_with_updates.id))
    evs = _events(approved_request.id)
    assert [e.action for e in evs] == ["edited"]
    assert evs[0].changes.get("customer") == ["Acme Corp", "Notify Corp"]


# ===========================================================================
# 4. Notification failures
# ===========================================================================

@pytest.mark.django_db
def test_failed_email_is_recorded_and_action_succeeds(api_client, warehouse, mocker):
    mocker.patch(
        "django.core.mail.backends.locmem.EmailBackend.send_messages",
        side_effect=ConnectionRefusedError("SMTP down"),
    )
    created = _public_create(api_client, warehouse)
    notes = _notifications(created["id"])
    assert len(notes) == 2
    for n in notes:
        assert n.status == "failed"
        assert "SMTP down" in n.error
    # the appointment itself was still created and audited
    assert [e.action for e in _events(created["id"])] == ["created"]


@pytest.mark.django_db
def test_sent_email_is_recorded(api_client, warehouse):
    created = _public_create(api_client, warehouse)
    assert len(mail.outbox) == 2
    subjects = {m.subject for m in mail.outbox}
    logged = {n.subject for n in _notifications(created["id"])}
    assert logged == subjects


@pytest.mark.django_db
def test_failed_sms_is_recorded_as_failed(dana_client, request_with_driver, sms_log_consented, mocker):
    from twilio.base.exceptions import TwilioRestException

    client_cls = mocker.patch("members.messages.Client")
    client_cls.return_value.messages.create.side_effect = TwilioRestException(
        400, "https://api.twilio.test", msg="Invalid number"
    )
    body = dana_client.get(f"/api/request/{request_with_driver.id}/").json()
    body = {k: v for k, v in body.items() if k not in READ_ONLY_KEYS}
    body.update({"dock_number": 3, "docked_time": _iso(timezone.now()), "customer_id": None})
    resp = dana_client.put(f"/api/request/{request_with_driver.id}/", body, format="json")
    assert resp.status_code == 400   # view still maps Twilio errors to 400
    sms = [n for n in _notifications(request_with_driver.id) if n.channel == "sms"]
    assert len(sms) == 1
    assert sms[0].status == "failed"
    assert sms[0].kind == "dock_ready"
    assert sms[0].recipient == "+15555550001"
    assert sms[0].error


# ===========================================================================
# 5. Permissions matrix
# ===========================================================================

@pytest.fixture
def some_appointment(db, warehouse):
    return _make_request(warehouse)


def _all_endpoints(appt_id):
    return [
        EVENTS_URL,
        NOTIFICATIONS_URL,
        f"{TIMELINE_URL}?appointment={appt_id}",
        ACTORS_URL,
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("idx", range(4), ids=["events", "notifications", "timeline", "actors"])
def test_anonymous_gets_401(api_client, some_appointment, idx):
    url = _all_endpoints(some_appointment.id)[idx]
    assert api_client.get(url).status_code == 401


@pytest.mark.django_db
@pytest.mark.parametrize("idx", range(4), ids=["events", "notifications", "timeline", "actors"])
def test_dock_gets_403(dock_client, some_appointment, idx):
    url = _all_endpoints(some_appointment.id)[idx]
    assert dock_client.get(url).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("who", ["dispatch", "admin_group", "superuser"])
@pytest.mark.parametrize("idx", range(4), ids=["events", "notifications", "timeline", "actors"])
def test_audit_viewers_get_200(who, idx, dispatch_client, admin_client, superuser_client, some_appointment):
    client = {"dispatch": dispatch_client, "admin_group": admin_client,
              "superuser": superuser_client}[who]
    url = _all_endpoints(some_appointment.id)[idx]
    assert client.get(url).status_code == 200


@pytest.mark.django_db
def test_dock_gets_403_on_csv_export(dock_client):
    assert dock_client.get(EVENTS_URL, {"export": "csv"}).status_code == 403
    assert dock_client.get(NOTIFICATIONS_URL, {"export": "csv"}).status_code == 403


@pytest.mark.django_db
def test_user_with_no_groups_gets_403(db, some_appointment):
    nobody = User.objects.create_user(username="nobody", password="pw-123456")
    client = _make_authed_client(nobody)
    for url in _all_endpoints(some_appointment.id):
        assert client.get(url).status_code == 403, url


@pytest.mark.django_db
def test_audit_endpoints_are_read_only(dispatch_client):
    for url in (EVENTS_URL, NOTIFICATIONS_URL, ACTORS_URL):
        assert dispatch_client.post(url, {}, format="json").status_code in (403, 405)
        assert dispatch_client.delete(url).status_code in (403, 405)


# ===========================================================================
# 6. Event filters, ordering, paging, CSV
# ===========================================================================

@pytest.fixture
def event_dataset(db, warehouse, second_warehouse, dana):
    """
    A fixed set of events written directly (occurred_at chosen by the test):

      e_jan09  approved   dana   warehouse        2026-01-09 12:00 NY
      e_jan10  edited     dana   warehouse        2026-01-10 00:30 NY  (05:30 UTC)
      e_jan11  cancelled  other  second           2026-01-11 23:30 NY  (Jan 12 04:30 UTC)
      e_jan12  created    None   second           2026-01-12 09:00 NY
      e_null   approved   other  warehouse        occurred_at NULL (imported)
    """
    E = Event()
    other = User.objects.create_user(username="zed", password="pw-123456")
    other.groups.add(_group("Dispatch"))
    a1 = _make_request(warehouse, "Alpha Co", "ALPHA-1")
    a2 = _make_request(second_warehouse, "Beta Co", "BETA-1")
    E.objects.all().delete()  # in case ORM creates were captured
    rows = {
        "e_jan09": E.objects.create(appointment=a1, actor=dana, action="approved",
                                    occurred_at=_ny(2026, 1, 9, 12, 0)),
        "e_jan10": E.objects.create(appointment=a1, actor=dana, action="edited",
                                    changes={"note_section": [None, "x"]},
                                    occurred_at=_ny(2026, 1, 10, 0, 30)),
        "e_jan11": E.objects.create(appointment=a2, actor=other, action="cancelled",
                                    occurred_at=_ny(2026, 1, 11, 23, 30)),
        "e_jan12": E.objects.create(appointment=a2, actor=None, action="created",
                                    occurred_at=_ny(2026, 1, 12, 9, 0)),
        "e_null": E.objects.create(appointment=a1, actor=other, action="approved",
                                   occurred_at=None),
    }
    return {"rows": rows, "a1": a1, "a2": a2, "dana": dana, "other": other}


def _ids(resp):
    assert resp.status_code == 200, resp.content
    return [r["id"] for r in resp.json()["results"]]


def _expect(ds, *names):
    return [str(ds["rows"][n].id) for n in names]


@pytest.mark.django_db
def test_events_ordered_newest_first_null_last(dispatch_client, event_dataset):
    ds = event_dataset
    assert _ids(dispatch_client.get(EVENTS_URL)) == _expect(
        ds, "e_jan12", "e_jan11", "e_jan10", "e_jan09", "e_null")


@pytest.mark.django_db
def test_events_null_actor_names(dispatch_client, event_dataset):
    E = Event()
    ds = event_dataset
    E.objects.create(appointment=ds["a1"], actor=None, action="edited",
                     changes={"note_section": ["x", "y"]}, occurred_at=_ny(2026, 1, 13))
    results = dispatch_client.get(EVENTS_URL).json()["results"]
    by_action = {(r["action"], r["actor"]): r["actor_name"] for r in results}
    assert by_action[("created", None)] == "Request form"
    assert by_action[("edited", None)] == "Unknown"


@pytest.mark.django_db
def test_events_filter_by_actor(dispatch_client, event_dataset):
    ds = event_dataset
    assert _ids(dispatch_client.get(EVENTS_URL, {"actor": ds["dana"].id})) == _expect(
        ds, "e_jan10", "e_jan09")
    assert _ids(dispatch_client.get(EVENTS_URL, {"actor": "none"})) == _expect(ds, "e_jan12")


@pytest.mark.django_db
def test_events_filter_by_action_list(dispatch_client, event_dataset):
    ds = event_dataset
    assert _ids(dispatch_client.get(EVENTS_URL, {"action": "approved"})) == _expect(
        ds, "e_jan09", "e_null")
    assert _ids(dispatch_client.get(EVENTS_URL, {"action": "cancelled,created"})) == _expect(
        ds, "e_jan12", "e_jan11")


@pytest.mark.django_db
def test_events_filter_by_warehouse_and_appointment(dispatch_client, event_dataset, second_warehouse):
    ds = event_dataset
    assert _ids(dispatch_client.get(EVENTS_URL, {"warehouse": str(second_warehouse.id)})) == \
        _expect(ds, "e_jan12", "e_jan11")
    assert _ids(dispatch_client.get(EVENTS_URL, {"appointment": str(ds["a1"].id)})) == \
        _expect(ds, "e_jan10", "e_jan09", "e_null")


@pytest.mark.django_db
def test_events_date_range_is_inclusive_new_york(dispatch_client, event_dataset):
    ds = event_dataset
    # Jan 10 00:30 NY is Jan 10 05:30 UTC; Jan 11 23:30 NY is Jan 12 04:30 UTC.
    # Both are inside [Jan 10, Jan 11] only when the range is read in New York time.
    resp = dispatch_client.get(EVENTS_URL, {"start": "2026-01-10", "end": "2026-01-11"})
    assert _ids(resp) == _expect(ds, "e_jan11", "e_jan10")
    resp = dispatch_client.get(EVENTS_URL, {"start": "2026-01-12"})
    assert _ids(resp) == _expect(ds, "e_jan12")
    resp = dispatch_client.get(EVENTS_URL, {"end": "2026-01-09"})
    assert _ids(resp) == _expect(ds, "e_jan09")


@pytest.mark.django_db
def test_events_combined_filters(dispatch_client, event_dataset):
    ds = event_dataset
    resp = dispatch_client.get(EVENTS_URL, {
        "actor": ds["dana"].id, "action": "edited,approved",
        "start": "2026-01-10", "end": "2026-01-31",
    })
    assert _ids(resp) == _expect(ds, "e_jan10")


@pytest.mark.django_db
def test_events_paging(dispatch_client, event_dataset):
    ds = event_dataset
    page1 = dispatch_client.get(EVENTS_URL, {"page_size": 2})
    body = page1.json()
    assert body["count"] == 5
    assert body["previous"] is None
    assert body["next"]
    assert _ids(page1) == _expect(ds, "e_jan12", "e_jan11")
    page3 = dispatch_client.get(EVENTS_URL, {"page_size": 2, "page": 3})
    body3 = page3.json()
    assert _ids(page3) == _expect(ds, "e_null")
    assert body3["next"] is None
    assert body3["previous"]


@pytest.mark.django_db
def test_events_page_size_capped_at_500(dispatch_client, event_dataset):
    E = Event()
    ds = event_dataset
    E.objects.bulk_create([
        E(appointment=ds["a1"], actor=ds["dana"], action="edited",
          changes={"note_section": ["a", "b"]}, occurred_at=_ny(2025, 6, 1))
        for _ in range(505)
    ])
    resp = dispatch_client.get(EVENTS_URL, {"page_size": 1000})
    assert resp.status_code == 200
    assert resp.json()["count"] == 510
    assert len(resp.json()["results"]) == 500
    default = dispatch_client.get(EVENTS_URL).json()
    assert len(default["results"]) == 50


@pytest.mark.django_db
def test_events_csv_matches_filters(dispatch_client, event_dataset, warehouse):
    ds = event_dataset
    params = {"warehouse": str(warehouse.id), "action": "approved,edited"}
    json_ids = _ids(dispatch_client.get(EVENTS_URL, params))
    resp = dispatch_client.get(EVENTS_URL, {**params, "export": "csv", "page_size": 1})
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/csv")
    assert "attachment" in resp["Content-Disposition"]
    header, rows = _csv_rows(resp)
    assert header == EVENT_CSV_COLUMNS
    assert len(rows) == len(json_ids) == 3   # paging ignored
    col = {name: i for i, name in enumerate(header)}
    assert {r[col["action"]] for r in rows} == {"approved", "edited"}
    assert {r[col["appointment"]] for r in rows} == {str(ds["a1"].id)}
    assert {r[col["warehouse_name"]] for r in rows} == {warehouse.name}
    edited = next(r for r in rows if r[col["action"]] == "edited")
    assert "note_section" in edited[col["changes"]]
    assert edited[col["actor_name"]] == "Dana Smith"
    assert edited[col["appointment_ref"]] == "ALPHA-1"
    assert edited[col["appointment_company"]] == "Alpha Co"


@pytest.mark.django_db
def test_events_csv_unfiltered_includes_everything(dispatch_client, event_dataset):
    resp = dispatch_client.get(EVENTS_URL, {"export": "csv"})
    _, rows = _csv_rows(resp)
    assert len(rows) == 5


# ===========================================================================
# 7. Notification filters, paging, CSV
# ===========================================================================

@pytest.fixture
def notification_dataset(db, warehouse, second_warehouse):
    N = Notification()
    a1 = _make_request(warehouse, "Alpha Co", "ALPHA-1")
    a2 = _make_request(second_warehouse, "Beta Co", "BETA-1")
    N.objects.all().delete()
    rows = {
        "n1": N.objects.create(appointment=a1, channel="email", recipient="Ops@Alpha.test",
                               kind="approval", subject="Approved - #ALPHA-1", status="sent",
                               sent_at=_ny(2026, 2, 1, 10)),
        "n2": N.objects.create(appointment=a1, channel="sms", recipient="+15555550100",
                               kind="dock_ready", status="failed", error="Invalid number",
                               sent_at=_ny(2026, 2, 2, 23, 45)),
        "n3": N.objects.create(appointment=a2, channel="email", recipient="beta@beta.test",
                               kind="cancellation", subject="Cancelled - #BETA-1",
                               status="sent", sent_at=_ny(2026, 2, 3, 8)),
        "n4": N.objects.create(appointment=None, channel="email", recipient="team@candor.test",
                               kind="new_request", subject="New Pending Request",
                               status="failed", error="SMTP down",
                               sent_at=_ny(2026, 2, 4, 8)),
    }
    return {"rows": rows, "a1": a1, "a2": a2}


@pytest.mark.django_db
def test_notifications_ordered_and_shaped(dispatch_client, notification_dataset, warehouse):
    ds = notification_dataset
    resp = dispatch_client.get(NOTIFICATIONS_URL)
    assert _ids(resp) == _expect(ds, "n4", "n3", "n2", "n1")
    n1 = resp.json()["results"][-1]
    assert n1["appointment"] == str(ds["a1"].id)
    assert n1["appointment_ref"] == "ALPHA-1"
    assert n1["appointment_company"] == "Alpha Co"
    assert n1["warehouse_name"] == warehouse.name
    assert n1["channel"] == "email"
    assert n1["kind"] == "approval"
    assert n1["subject"] == "Approved - #ALPHA-1"
    assert n1["status"] == "sent"
    assert n1["error"] == ""
    assert n1["sent_at"]
    orphan = resp.json()["results"][0]
    assert orphan["appointment"] is None


@pytest.mark.django_db
def test_notifications_filters(dispatch_client, notification_dataset, second_warehouse):
    ds = notification_dataset
    get = lambda **p: _ids(dispatch_client.get(NOTIFICATIONS_URL, p))  # noqa: E731
    assert get(channel="sms") == _expect(ds, "n2")
    assert get(kind="approval,cancellation") == _expect(ds, "n3", "n1")
    assert get(status="failed") == _expect(ds, "n4", "n2")
    assert get(recipient="alpha.TEST") == _expect(ds, "n1")        # icontains
    assert get(warehouse=str(second_warehouse.id)) == _expect(ds, "n3")
    assert get(appointment=str(ds["a1"].id)) == _expect(ds, "n2", "n1")
    assert get(start="2026-02-02", end="2026-02-03") == _expect(ds, "n3", "n2")
    assert get(channel="email", status="failed") == _expect(ds, "n4")


@pytest.mark.django_db
def test_notifications_paging(dispatch_client, notification_dataset):
    ds = notification_dataset
    body = dispatch_client.get(NOTIFICATIONS_URL, {"page_size": 3}).json()
    assert body["count"] == 4 and len(body["results"]) == 3 and body["next"]
    assert _ids(dispatch_client.get(NOTIFICATIONS_URL, {"page_size": 3, "page": 2})) == \
        _expect(ds, "n1")


@pytest.mark.django_db
def test_notifications_csv_matches_filters(dispatch_client, notification_dataset):
    ds = notification_dataset
    params = {"status": "failed"}
    resp = dispatch_client.get(NOTIFICATIONS_URL, {**params, "export": "csv", "page_size": 1})
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/csv")
    assert "attachment" in resp["Content-Disposition"]
    header, rows = _csv_rows(resp)
    assert header == NOTIFICATION_CSV_COLUMNS
    col = {name: i for i, name in enumerate(header)}
    assert len(rows) == 2
    assert {r[col["status"]] for r in rows} == {"failed"}
    assert {r[col["recipient"]] for r in rows} == {"+15555550100", "team@candor.test"}
    sms = next(r for r in rows if r[col["channel"]] == "sms")
    assert sms[col["error"]] == "Invalid number"
    assert sms[col["kind"]] == "dock_ready"
    assert sms[col["appointment"]] == str(ds["a1"].id)


# ===========================================================================
# 8. Timeline
# ===========================================================================

@pytest.mark.django_db
def test_timeline_requires_appointment(dispatch_client):
    assert dispatch_client.get(TIMELINE_URL).status_code == 400


@pytest.mark.django_db
def test_timeline_merges_events_and_notifications(dispatch_client, dana, warehouse):
    E, N = Event(), Notification()
    appt = _make_request(warehouse, "Timeline Co", "TL-1")
    other = _make_request(warehouse, "Other Co", "OT-1")
    E.objects.filter(appointment__in=[appt, other]).delete()
    N.objects.filter(appointment__in=[appt, other]).delete()
    imported = E.objects.create(appointment=appt, actor=dana, action="approved", occurred_at=None)
    created = E.objects.create(appointment=appt, actor=None, action="created",
                               occurred_at=_ny(2026, 3, 1, 9))
    note = N.objects.create(appointment=appt, channel="email", recipient="tl@example.com",
                            kind="approval", subject="Approved - #TL-1", status="sent",
                            sent_at=_ny(2026, 3, 1, 10))
    edited = E.objects.create(appointment=appt, actor=dana, action="edited",
                              changes={"dock_number": [None, 4]},
                              occurred_at=_ny(2026, 3, 2, 9))
    E.objects.create(appointment=other, actor=dana, action="created",
                     occurred_at=_ny(2026, 3, 5))

    resp = dispatch_client.get(TIMELINE_URL, {"appointment": str(appt.id)})
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    assert [i["id"] for i in items] == [str(edited.id), str(note.id), str(created.id),
                                        str(imported.id)]
    assert [i["type"] for i in items] == ["event", "notification", "event", "event"]

    ev = items[0]
    assert ev["action"] == "edited"
    assert ev["actor_name"] == "Dana Smith"
    assert ev["changes"] == {"dock_number": [None, 4]}
    assert _parse_dt(ev["at"]) == _ny(2026, 3, 2, 9)

    nt = items[1]
    for key, value in {"channel": "email", "kind": "approval", "recipient": "tl@example.com",
                       "status": "sent", "subject": "Approved - #TL-1", "error": ""}.items():
        assert nt[key] == value
    assert items[2]["actor_name"] == "Request form"
    assert items[3]["at"] is None   # imported approval: "date unknown"


@pytest.mark.django_db
def test_timeline_for_real_journey(api_client, dana_client, warehouse):
    created = _public_create(api_client, warehouse)
    _put(dana_client, created["id"], approved=True)
    items = dana_client.get(TIMELINE_URL, {"appointment": created["id"]}).json()
    events = [i for i in items if i["type"] == "event"]
    notes = [i for i in items if i["type"] == "notification"]
    assert [e["action"] for e in events] == ["approved", "created"]
    assert {n["kind"] for n in notes} == {"new_request", "request_confirmation", "approval"}
    ats = [_parse_dt(i["at"]) for i in items]
    assert ats == sorted(ats, reverse=True)


# ===========================================================================
# 9. Actors
# ===========================================================================

@pytest.mark.django_db
def test_actors_lists_only_users_with_events_sorted_by_name(dispatch_client, warehouse):
    E = Event()
    appt = _make_request(warehouse)
    E.objects.all().delete()
    zoe = User.objects.create_user(username="zoe", first_name="Zoe", last_name="Adams")
    amy = User.objects.create_user(username="amy_b", first_name="Amy", last_name="Brown")
    bare = User.objects.create_user(username="mike")           # no full name
    User.objects.create_user(username="idle", first_name="Idle", last_name="User")
    for user in (zoe, amy, amy, bare):
        E.objects.create(appointment=appt, actor=user, action="edited",
                         changes={"note_section": ["a", "b"]})
    E.objects.create(appointment=appt, actor=None, action="created")

    resp = dispatch_client.get(ACTORS_URL)
    assert resp.status_code == 200
    assert resp.json() == [
        {"id": amy.id, "name": "Amy Brown"},
        {"id": bare.id, "name": "mike"},
        {"id": zoe.id, "name": "Zoe Adams"},
    ]


# ===========================================================================
# 10. Known bugs found in review (STAGE 2). Each is xfail(strict=True): it
#     documents the bug and turns into an XPASS failure once it is fixed, so
#     the marker must be removed with the fix.
# ===========================================================================

@pytest.mark.django_db
def test_bug_anonymous_delete_is_rejected(api_client, approved_request):
    resp = api_client.delete(f"/api/request/{approved_request.id}/")
    assert resp.status_code in (401, 403)
    approved_request.refresh_from_db()
    assert approved_request.active is True
    assert _events(approved_request.id) == []


@pytest.mark.django_db
@pytest.mark.parametrize("method,suffix", [
    ("get", ""), ("get", "{id}/"), ("put", "{id}/"), ("patch", "{id}/"), ("post", "{id}/remove/"),
])
def test_anonymous_cannot_read_or_modify_requests(api_client, approved_request, method, suffix):
    url = "/api/request/" + suffix.format(id=approved_request.id)
    resp = getattr(api_client, method)(url, {}, format="json")
    assert resp.status_code in (401, 403)
    approved_request.refresh_from_db()
    assert approved_request.active is True


@pytest.mark.django_db
def test_anonymous_slots_expose_only_times(api_client, approved_request, warehouse):
    day = approved_request.date_time
    resp = api_client.get("/api/request/slots/", {
        "start_date": (day - timedelta(hours=1)).isoformat(),
        "end_date": (day + timedelta(hours=1)).isoformat(),
    })
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert set(resp.data[0]) == {"warehouse", "date_time", "appointment_length"}
    assert str(resp.data[0]["warehouse"]) == str(warehouse.id)


@pytest.mark.django_db
def test_slots_require_range_and_reject_garbage(api_client):
    assert api_client.get("/api/request/slots/").status_code == 400
    resp = api_client.get("/api/request/slots/", {"start_date": "nope", "end_date": "nope"})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_slots_exclude_inactive_and_filter_by_warehouse(api_client, approved_request):
    day = approved_request.date_time
    params = {"start_date": (day - timedelta(hours=1)).isoformat(),
              "end_date": (day + timedelta(hours=1)).isoformat()}
    other = Warehouse.objects.create(name="Other", address="x", phone_number="1")
    assert api_client.get("/api/request/slots/", {**params, "warehouse": str(other.id)}).data == []
    approved_request.active = False
    approved_request.save()
    assert api_client.get("/api/request/slots/", params).data == []


def _complete(appointment):
    now = timezone.now()
    appointment.check_in_time = now - timedelta(hours=2)
    appointment.docked_time = now - timedelta(hours=1)
    appointment.dock_number = 4
    appointment.completed_time = now
    appointment.save()


@pytest.mark.django_db
def test_remove_endpoint_marks_inactive_without_email(dana_client, dana, approved_request):
    _complete(approved_request)
    mail.outbox.clear()
    resp = dana_client.post(f"/api/request/{approved_request.id}/remove/")
    assert resp.status_code == 200
    approved_request.refresh_from_db()
    assert approved_request.active is False
    assert approved_request.cancelled_time is None
    assert mail.outbox == []
    assert _notifications(approved_request.id) == []
    events = _events(approved_request.id)
    assert [e.action for e in events] == ["removed"]
    assert events[0].actor == dana


@pytest.mark.django_db
def test_removed_is_filterable_in_audit_api(dana_client, approved_request):
    dana_client.post(f"/api/request/{approved_request.id}/remove/")
    resp = dana_client.get("/api/audit/events/", {"action": "removed"})
    assert resp.status_code == 200
    assert [r["action"] for r in resp.data["results"]] == ["removed"]


@pytest.mark.django_db
def test_put_inactive_on_approved_appointment_is_a_removal_not_a_decline(dana_client, approved_request):
    """Older clients sent PUT {active: false} for Remove from Calendar."""
    _complete(approved_request)
    mail.outbox.clear()
    _put(dana_client, approved_request.id, active=False)
    assert "declined" not in [e.action for e in _events(approved_request.id)]
    assert "removed" in [e.action for e in _events(approved_request.id)]
    assert "decline" not in [n.kind for n in _notifications(approved_request.id)]
    assert mail.outbox == []


@pytest.mark.django_db
def test_put_inactive_on_pending_request_is_still_a_decline(dana_client, pending_request):
    _put(dana_client, pending_request.id, active=False)
    assert "declined" in [e.action for e in _events(pending_request.id)]
    assert "decline" in [n.kind for n in _notifications(pending_request.id)]


@pytest.mark.django_db
def test_bug_ui_seconds_precision_does_not_record_false_edit(dana_client, approved_request):
    assert approved_request.date_time.microsecond != 0
    local = timezone.localtime(approved_request.date_time)
    _put(dana_client, approved_request.id,
         note_section="unchanged date", date_time=local.strftime("%Y-%m-%d %H:%M:%S"))
    edits = [e for e in _events(approved_request.id) if e.action == "edited"]
    assert len(edits) == 1
    assert set(edits[0].changes) == {"note_section"}


@pytest.mark.django_db
def test_bug_nonpositive_env_retention_does_not_wipe_audit_trail(warehouse, settings):
    from django.core.management import call_command
    from django.core.management.base import CommandError

    appt = _make_request(warehouse)
    recent = Event().objects.create(appointment=appt, action="edited",
                                    changes={"note_section": ["a", "b"]},
                                    occurred_at=timezone.now() - timedelta(hours=1))
    note = Notification().objects.create(appointment=appt, channel="email", recipient="x@y.z",
                                         kind="approval", status="sent",
                                         sent_at=timezone.now() - timedelta(hours=1))
    settings.AUDIT_RETENTION_DAYS = 0
    settings.NOTIFICATION_RETENTION_DAYS = -1
    try:
        call_command("prune_audit_logs", stdout=io.StringIO())
    except CommandError:
        pass   # refusing to run is an acceptable fix
    assert Event().objects.filter(pk=recent.pk).exists()
    assert Notification().objects.filter(pk=note.pk).exists()


@pytest.mark.django_db
def test_bug_superuser_can_still_delete_request_in_admin(rf, superuser, warehouse):
    from django.contrib import admin as django_admin

    appt = _make_request(warehouse)
    Event().objects.create(appointment=appt, action="created")
    request = rf.get("/admin/")
    request.user = superuser
    model_admin = django_admin.site._registry[Request]
    _, _, perms_needed, protected = model_admin.get_deleted_objects([appt], request)
    assert not perms_needed, f"admin delete blocked by: {perms_needed}"
    assert not protected

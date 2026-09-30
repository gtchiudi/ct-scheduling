"""
Audit capture tests — AppointmentEvent rows written by RequestView.

Covers every action (created, approved, declined, edited, checked_in, docked,
completed, cancelled via PUT and via DELETE), several events from one save,
no-op saves, FK display strings, anonymous creation, capture failures that must
not break the save, and the ApprovalLog -> AppointmentEvent data migration.
"""

import importlib
import uuid
from datetime import timedelta

import pytest
from django.apps import apps as django_apps
from django.db import DatabaseError
from django.utils import timezone

from members.models import AppointmentEvent, ApprovalLog, Customer, Request, Warehouse
from members.tests.conftest import build_request_payload


def _put(client, req, **overrides):
    return client.put(f"/api/request/{req.id}/", build_request_payload(req, overrides), format="json")


def _iso(dt):
    return timezone.localtime(dt).isoformat()


def _events(req):
    return list(AppointmentEvent.objects.filter(appointment=req).order_by("occurred_at"))


def _create_payload(warehouse, approved=False):
    return {
        "approved": approved,
        "company_name": "Audit Co",
        "email": "audit@example.com",
        "warehouse": str(warehouse.id),
        "ref_number": "AUD-1",
        "load_type": "Full",
        "date_time": (timezone.now() + timedelta(days=3)).isoformat(),
        "delivery": True,
    }


# ---------------------------------------------------------------------------
# created
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_anonymous_create_records_created_event_with_null_actor(api_client, warehouse, mock_email):
    response = api_client.post("/api/request/", _create_payload(warehouse), format="json")
    assert response.status_code == 201
    req = Request.objects.get(id=response.data["id"])
    assert req.created_by is None
    assert req.created_at is not None
    events = _events(req)
    assert [(e.action, e.actor, e.changes) for e in events] == [("created", None, {})]
    assert events[0].occurred_at is not None


@pytest.mark.django_db
def test_authenticated_create_sets_created_by_and_actor(dispatch_client, dispatch_user, warehouse, mock_email):
    response = dispatch_client.post("/api/request/", _create_payload(warehouse, approved=True), format="json")
    assert response.status_code == 201
    assert response.data["created_by"] == dispatch_user.id
    assert response.data["created_by_name"] == "dispatch_test"
    assert response.data["created_at"] is not None
    assert response.data["updated_at"] is not None
    req = Request.objects.get(id=response.data["id"])
    assert req.created_by == dispatch_user
    events = _events(req)
    assert [(e.action, e.actor) for e in events] == [("created", dispatch_user)]


@pytest.mark.django_db
def test_created_by_is_read_only(dispatch_client, admin_user, warehouse, mock_email):
    payload = _create_payload(warehouse)
    payload["created_by"] = admin_user.id
    response = dispatch_client.post("/api/request/", payload, format="json")
    assert response.status_code == 201
    assert Request.objects.get(id=response.data["id"]).created_by.username == "dispatch_test"


@pytest.mark.django_db
def test_serializer_exposes_full_name(dispatch_client, dispatch_user, warehouse, mock_email):
    dispatch_user.first_name, dispatch_user.last_name = "Dana", "Smith"
    dispatch_user.save()
    response = dispatch_client.post("/api/request/", _create_payload(warehouse), format="json")
    got = dispatch_client.get(f"/api/request/{response.data['id']}/")
    assert got.data["created_by_name"] == "Dana Smith"


# ---------------------------------------------------------------------------
# Lifecycle actions via PUT
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_approve_records_approved_event(dispatch_client, dispatch_user, pending_request, mock_email):
    assert _put(dispatch_client, pending_request, approved=True).status_code == 200
    events = _events(pending_request)
    assert [(e.action, e.actor, e.changes) for e in events] == [("approved", dispatch_user, {})]


@pytest.mark.django_db
def test_decline_records_declined_event(dispatch_client, pending_request, mock_email):
    assert _put(dispatch_client, pending_request, active=False).status_code == 200
    assert [e.action for e in _events(pending_request)] == ["declined"]


@pytest.mark.django_db
def test_cancel_via_cancelled_time_records_cancelled_only(dispatch_client, approved_request, mock_email):
    now = timezone.now().isoformat()
    assert _put(dispatch_client, approved_request, cancelled_time=now).status_code == 200
    assert [e.action for e in _events(approved_request)] == ["cancelled"]


@pytest.mark.django_db
def test_cancel_with_active_false_is_not_a_decline(dispatch_client, approved_request, mock_email):
    now = timezone.now().isoformat()
    _put(dispatch_client, approved_request, cancelled_time=now, active=False)
    assert [e.action for e in _events(approved_request)] == ["cancelled"]


@pytest.mark.django_db
@pytest.mark.parametrize("field,action", [
    ("check_in_time", "checked_in"),
    ("docked_time", "docked"),
    ("completed_time", "completed"),
])
def test_lifecycle_timestamps_record_their_event(dispatch_client, approved_request, mock_email, mock_sms, field, action):
    assert _put(dispatch_client, approved_request, **{field: timezone.now().isoformat()}).status_code == 200
    events = _events(approved_request)
    assert [(e.action, e.changes) for e in events] == [(action, {})]


@pytest.mark.django_db
def test_changing_an_existing_lifecycle_timestamp_is_not_an_event(dispatch_client, approved_request, mock_email):
    approved_request.check_in_time = timezone.now() - timedelta(hours=1)
    approved_request.save()
    _put(dispatch_client, approved_request, check_in_time=timezone.now().isoformat())
    assert _events(approved_request) == []


# ---------------------------------------------------------------------------
# DELETE (soft delete)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_delete_records_cancelled_event(dispatch_client, dispatch_user, approved_request):
    response = dispatch_client.delete(f"/api/request/{approved_request.id}/")
    assert response.status_code == 204
    approved_request.refresh_from_db()
    assert approved_request.active is False
    events = _events(approved_request)
    assert [(e.action, e.actor, e.changes) for e in events] == [("cancelled", dispatch_user, {})]


# ---------------------------------------------------------------------------
# edited
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_edit_records_only_changed_fields(dispatch_client, dispatch_user, approved_request, mock_email):
    _put(dispatch_client, approved_request, note_section="Bring pallets", ref_number="PO-NEW")
    events = _events(approved_request)
    assert len(events) == 1
    assert events[0].action == "edited"
    assert events[0].actor == dispatch_user
    assert events[0].changes == {
        "note_section": [None, "Bring pallets"],
        "ref_number": ["PO-APPROVED", "PO-NEW"],
    }


@pytest.mark.django_db
def test_edit_date_time_stored_as_iso_strings(dispatch_client, approved_request, mock_email):
    old = approved_request.date_time
    new = old + timedelta(days=1, hours=2)
    _put(dispatch_client, approved_request, date_time=new.isoformat())
    (event,) = _events(approved_request)
    assert event.changes == {"date_time": [_iso(old), _iso(new)]}


@pytest.mark.django_db
def test_edit_warehouse_and_customer_stored_as_display_strings(
    dispatch_client, approved_request, customer, customer_with_updates, mock_email
):
    other = Warehouse.objects.create(name="Second Dock", address="1 Road", phone_number="5550000000")
    _put(dispatch_client, approved_request, warehouse=str(other.id), customer_id=str(customer_with_updates.id))
    (event,) = _events(approved_request)
    assert event.changes == {
        "warehouse": ["Test Warehouse", "Second Dock"],
        "customer": ["Acme Corp", "Notify Corp"],
    }


@pytest.mark.django_db
def test_multiple_events_from_one_save(dispatch_client, dispatch_user, pending_request, mock_email):
    _put(dispatch_client, pending_request, approved=True, dock_number=4, trailer_number="TR-9")
    events = _events(pending_request)
    assert [e.action for e in events] == ["approved", "edited"]
    assert all(e.actor == dispatch_user for e in events)
    assert events[1].changes == {"dock_number": [None, 4], "trailer_number": [None, "TR-9"]}


@pytest.mark.django_db
def test_no_op_save_records_nothing(dispatch_client, approved_request, pending_request, mock_email):
    assert _put(dispatch_client, approved_request).status_code == 200
    assert _put(dispatch_client, pending_request).status_code == 200
    assert AppointmentEvent.objects.count() == 0


@pytest.mark.django_db
def test_patch_records_events(dispatch_client, approved_request, mock_email):
    response = dispatch_client.patch(
        f"/api/request/{approved_request.id}/", {"note_section": "patched"}, format="json")
    assert response.status_code == 200
    (event,) = _events(approved_request)
    assert event.changes == {"note_section": [None, "patched"]}


@pytest.mark.django_db
def test_invalid_update_records_nothing(dispatch_client, approved_request, mock_email):
    response = _put(dispatch_client, approved_request, load_type="Bogus")
    assert response.status_code == 400
    assert AppointmentEvent.objects.count() == 0


@pytest.mark.django_db
def test_events_recorded_even_when_twilio_fails(
    dispatch_client, request_with_driver, sms_log_consented, mock_email, mocker
):
    from twilio.base.exceptions import TwilioRestException
    mocker.patch("members.views.send_text", side_effect=TwilioRestException(400, "uri", "boom"))
    response = _put(dispatch_client, request_with_driver, dock_number=7)
    assert response.status_code == 400
    (event,) = _events(request_with_driver)
    assert event.changes == {"dock_number": [None, 7]}


# ---------------------------------------------------------------------------
# Capture failures must never break the action
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_capture_failure_does_not_break_update(dispatch_client, pending_request, mock_email, mocker, caplog):
    mocker.patch.object(AppointmentEvent.objects, "create", side_effect=DatabaseError("audit down"))
    response = _put(dispatch_client, pending_request, approved=True, note_section="still saved")
    assert response.status_code == 200
    pending_request.refresh_from_db()
    assert pending_request.approved is True
    assert pending_request.note_section == "still saved"
    assert ApprovalLog.objects.filter(request=pending_request).exists()
    assert mock_email.called
    assert "Audit: failed to record update" in caplog.text


@pytest.mark.django_db
def test_capture_failure_does_not_break_create(api_client, warehouse, mock_email, mocker, caplog):
    mocker.patch.object(AppointmentEvent.objects, "create", side_effect=DatabaseError("audit down"))
    response = api_client.post("/api/request/", _create_payload(warehouse), format="json")
    assert response.status_code == 201
    assert Request.objects.filter(id=response.data["id"]).exists()
    assert "Audit: failed to record creation" in caplog.text


@pytest.mark.django_db
def test_capture_failure_does_not_break_delete(dispatch_client, approved_request, mocker):
    mocker.patch.object(AppointmentEvent.objects, "create", side_effect=DatabaseError("audit down"))
    assert dispatch_client.delete(f"/api/request/{approved_request.id}/").status_code == 204
    approved_request.refresh_from_db()
    assert approved_request.active is False


@pytest.mark.django_db
def test_partial_capture_failure_is_rolled_back_to_savepoint(dispatch_client, pending_request, mock_email, mocker):
    """If the second event of a save fails, the first is rolled back too — no half-written trail."""
    real_create = AppointmentEvent.objects.create
    calls = {"n": 0}

    def flaky(**kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise DatabaseError("second insert fails")
        return real_create(**kwargs)

    mocker.patch.object(AppointmentEvent.objects, "create", side_effect=flaky)
    assert _put(dispatch_client, pending_request, approved=True, note_section="x").status_code == 200
    assert AppointmentEvent.objects.count() == 0
    pending_request.refresh_from_db()
    assert pending_request.approved is True


# ---------------------------------------------------------------------------
# Ordering / model
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_default_ordering_newest_first_null_last(approved_request):
    now = timezone.now()
    AppointmentEvent.objects.create(appointment=approved_request, action="approved", occurred_at=None)
    AppointmentEvent.objects.create(appointment=approved_request, action="created", occurred_at=now - timedelta(days=1))
    AppointmentEvent.objects.create(appointment=approved_request, action="edited", occurred_at=now)
    assert [e.action for e in AppointmentEvent.objects.all()] == ["edited", "created", "approved"]


@pytest.mark.django_db
def test_events_cascade_with_appointment(approved_request):
    AppointmentEvent.objects.create(appointment=approved_request, action="created")
    Request.objects.filter(id=approved_request.id).delete()  # hard delete via queryset
    assert AppointmentEvent.objects.count() == 0


# ---------------------------------------------------------------------------
# Data migration: ApprovalLog -> approved events
# ---------------------------------------------------------------------------

_migration = importlib.import_module("members.migrations.0022_import_approvallog_events")


@pytest.mark.django_db
def test_data_migration_imports_each_approval_log(approved_request, pending_request, dispatch_user, admin_user):
    ApprovalLog.objects.create(approver=dispatch_user, request=approved_request)
    ApprovalLog.objects.create(approver=admin_user, request=pending_request)
    ApprovalLog.objects.create(approver=None, request=pending_request)

    _migration.import_approval_logs(django_apps, None)

    events = AppointmentEvent.objects.all()
    assert events.count() == 3
    assert all(e.action == "approved" and e.occurred_at is None and e.changes == {} for e in events)
    assert set(events.values_list("appointment_id", "actor_id")) == {
        (approved_request.id, dispatch_user.id),
        (pending_request.id, admin_user.id),
        (pending_request.id, None),
    }
    # ApprovalLog is left untouched.
    assert ApprovalLog.objects.count() == 3


@pytest.mark.django_db
def test_data_migration_batches_and_reverses(approved_request, dispatch_user, monkeypatch):
    monkeypatch.setattr(_migration, "BATCH_SIZE", 2)
    for _ in range(5):
        ApprovalLog.objects.create(approver=dispatch_user, request=approved_request)
    live = AppointmentEvent.objects.create(appointment=approved_request, action="approved")

    _migration.import_approval_logs(django_apps, None)
    assert AppointmentEvent.objects.filter(occurred_at__isnull=True).count() == 5

    _migration.remove_imported_events(django_apps, None)
    assert list(AppointmentEvent.objects.all()) == [live]

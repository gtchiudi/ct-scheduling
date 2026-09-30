"""
NotificationLog tests — every email/SMS attempt is recorded by members.messages.

These tests deliberately do NOT use the mock_email / mock_sms fixtures (which
replace the functions that do the logging). Email goes through Django's locmem
backend (set up by the test runner); SMS is mocked at the Twilio Client.
"""

import uuid
from datetime import timedelta
from unittest import mock

import pytest
from django.core import mail
from django.db import DatabaseError
from django.utils import timezone
from twilio.base.exceptions import TwilioRestException

from members import messages
from members.models import NotificationLog, Request, SmsNumberLog
from members.tests.conftest import build_request_payload


@pytest.fixture
def twilio(mocker):
    """Patch the Twilio Client used by messages.send_text; returns the client instance mock."""
    client_cls = mocker.patch("members.messages.Client")
    instance = client_cls.return_value
    instance.messages.create.return_value = mock.Mock(sid="SM123")
    return instance


def _kinds(**filters):
    return sorted(NotificationLog.objects.filter(**filters).values_list("kind", flat=True))


# ---------------------------------------------------------------------------
# send_email
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_send_email_records_sent(approved_request):
    messages.send_email("a@b.com", "Subject line", "<p>hi</p>", appointment=approved_request, kind="approval")
    assert len(mail.outbox) == 1
    log = NotificationLog.objects.get()
    assert (log.channel, log.recipient, log.kind, log.subject, log.status, log.error) == (
        "email", "a@b.com", "approval", "Subject line", "sent", "")
    assert log.appointment == approved_request
    assert log.sent_at is not None


@pytest.mark.django_db
def test_send_email_records_failed_and_swallows(approved_request, mocker):
    mocker.patch("members.messages.EmailMessage.send", side_effect=OSError("smtp down"))
    messages.send_email("a@b.com", "S", "B", appointment=approved_request, kind="decline")  # no raise
    log = NotificationLog.objects.get()
    assert (log.channel, log.status, log.error, log.kind) == ("email", "failed", "smtp down", "decline")


@pytest.mark.django_db
def test_send_email_accepts_appointment_id_and_defaults(approved_request):
    messages.send_email("a@b.com", "S", "B", appointment=str(approved_request.id))
    messages.send_email("c@d.com", "S", "B")
    logs = {log.recipient: log for log in NotificationLog.objects.all()}
    assert logs["a@b.com"].appointment_id == approved_request.id
    assert logs["c@d.com"].appointment is None
    assert logs["c@d.com"].kind == ""


@pytest.mark.django_db
def test_log_failure_does_not_block_email(mocker, caplog):
    mocker.patch.object(NotificationLog.objects, "create", side_effect=DatabaseError("log down"))
    messages.send_email("a@b.com", "S", "B", kind="approval")
    assert len(mail.outbox) == 1
    assert "Failed to record email notification" in caplog.text


@pytest.mark.django_db
def test_notification_survives_appointment_deletion(approved_request):
    messages.send_email("a@b.com", "S", "B", appointment=approved_request, kind="approval")
    Request.objects.filter(id=approved_request.id).delete()
    log = NotificationLog.objects.get()
    assert log.appointment is None


# ---------------------------------------------------------------------------
# send_text
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_send_text_records_sent(approved_request, twilio):
    messages.send_text("+15550001111", "body", appointment=approved_request, kind="dock_ready")
    twilio.messages.create.assert_called_once()
    log = NotificationLog.objects.get()
    assert (log.channel, log.recipient, log.kind, log.subject, log.status) == (
        "sms", "+15550001111", "dock_ready", "", "sent")


@pytest.mark.django_db
def test_send_text_records_failed_and_reraises(approved_request, twilio):
    twilio.messages.create.side_effect = TwilioRestException(400, "uri", "bad number")
    with pytest.raises(TwilioRestException):
        messages.send_text("+15550001111", "body", appointment=approved_request, kind="yard_drop")
    log = NotificationLog.objects.get()
    assert (log.channel, log.status, log.kind) == ("sms", "failed", "yard_drop")
    assert "bad number" in log.error


@pytest.mark.django_db
def test_log_failure_does_not_block_text(twilio, mocker):
    mocker.patch.object(NotificationLog.objects, "create", side_effect=DatabaseError("log down"))
    messages.send_text("+15550001111", "body", kind="dock_ready")
    twilio.messages.create.assert_called_once()


# ---------------------------------------------------------------------------
# Each of the 11 send sites in views.py records the right kind
# ---------------------------------------------------------------------------

def _create_payload(warehouse, **overrides):
    payload = {
        "approved": False,
        "company_name": "Notify Co",
        "email": "requester@example.com",
        "warehouse": str(warehouse.id),
        "ref_number": "N-1",
        "load_type": "Full",
        "date_time": (timezone.now() + timedelta(days=3)).isoformat(),
        "delivery": True,
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_public_request_sends_new_request_and_confirmation(api_client, warehouse):
    response = api_client.post("/api/request/", _create_payload(warehouse), format="json")
    assert response.status_code == 201
    appt_id = response.data["id"]
    assert _kinds(appointment_id=appt_id) == ["new_request", "request_confirmation"]
    confirmation = NotificationLog.objects.get(kind="request_confirmation")
    assert confirmation.recipient == "requester@example.com"
    assert confirmation.subject == "Appointment Request Confirmation - #N-1"
    assert confirmation.status == "sent"


@pytest.mark.django_db
def test_calendar_create_sends_calendar_event_and_customer_scheduled(
    dispatch_client, warehouse, customer_with_updates
):
    payload = _create_payload(
        warehouse, approved=True, customer_id=str(customer_with_updates.id), send_email_updates=True)
    response = dispatch_client.post("/api/request/", payload, format="json")
    assert response.status_code == 201
    assert _kinds(appointment_id=response.data["id"]) == ["calendar_event", "customer_scheduled"]
    assert NotificationLog.objects.get(kind="customer_scheduled").recipient == "notify@example.com"


@pytest.mark.django_db
def test_approval_sends_approval_and_customer_scheduled(dispatch_client, pending_request, customer_with_updates):
    pending_request.customer = customer_with_updates
    pending_request.save()
    payload = build_request_payload(pending_request, {"approved": True, "send_email_updates": True})
    assert dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json").status_code == 200
    assert _kinds(appointment=pending_request) == ["approval", "customer_scheduled"]
    approval = NotificationLog.objects.get(kind="approval")
    assert approval.subject == "Appointment Request Approved - #PO-PENDING"
    assert approval.recipient == "pending@example.com"


@pytest.mark.django_db
def test_decline_sends_decline(dispatch_client, pending_request):
    payload = build_request_payload(pending_request, {"active": False})
    dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert _kinds(appointment=pending_request) == ["decline"]


@pytest.mark.django_db
def test_cancel_sends_cancellation(dispatch_client, approved_request):
    payload = build_request_payload(approved_request, {"cancelled_time": timezone.now().isoformat()})
    dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")
    assert _kinds(appointment=approved_request) == ["cancellation"]


@pytest.mark.django_db
def test_dock_assignment_sends_dock_ready(dispatch_client, request_with_driver, sms_log_consented, twilio):
    payload = build_request_payload(request_with_driver, {"dock_number": 3})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    log = NotificationLog.objects.get(appointment=request_with_driver)
    assert (log.channel, log.kind, log.recipient, log.status) == ("sms", "dock_ready", "+15555550001", "sent")


@pytest.mark.django_db
def test_container_drop_sends_yard_drop(dispatch_client, request_with_driver, sms_log_consented, twilio):
    request_with_driver.container_drop = True
    request_with_driver.save()
    payload = build_request_payload(request_with_driver, {"docked_time": timezone.now().isoformat()})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert _kinds(appointment=request_with_driver, channel="sms") == ["yard_drop"]


@pytest.mark.django_db
def test_new_driver_phone_sends_sms_subscribed(dispatch_client, approved_request, twilio):
    payload = build_request_payload(
        approved_request, {"driver_phone_number": "+15559990001", "sms_consent": True})
    dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")
    assert _kinds(appointment=approved_request) == ["sms_subscribed"]


@pytest.mark.django_db
def test_twilio_failure_in_view_records_failed_and_returns_400(
    dispatch_client, request_with_driver, sms_log_consented, twilio
):
    twilio.messages.create.side_effect = TwilioRestException(400, "uri", "unreachable")
    payload = build_request_payload(request_with_driver, {"dock_number": 3})
    response = dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert response.status_code == 400
    assert "twilio_error" in response.data
    log = NotificationLog.objects.get(appointment=request_with_driver)
    assert (log.kind, log.status) == ("dock_ready", "failed")

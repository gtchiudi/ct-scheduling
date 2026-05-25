"""
Business logic tests — every branch in RequestView.update().

The update() method has five major branches:
  1. Approval:      approved changes True  → ApprovalLog + email(s)
  2. Decline:       active set False (no cancelled_time) → decline email
  3. Cancellation:  cancelled_time set → active=False + cancellation email
  4. Dock SMS:      dock_number first assigned (or container_drop+docked_time) → SMS
  5. Driver phone:  driver_phone_number changes → SmsNumberLog + optional welcome SMS

All tests mock send_email and the Twilio Client to avoid real network calls.
"""

import uuid
import pytest
from datetime import timedelta
from django.utils import timezone

from members.models import ApprovalLog, Customer, Request, SmsNumberLog
from members.tests.conftest import build_request_payload


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _approve_payload(request_obj, **overrides):
    return build_request_payload(request_obj, {"approved": True, **overrides})


def _dt_str():
    return (timezone.now() + timedelta(days=7)).isoformat().replace("+00:00", "Z")


# ===========================================================================
# Branch 1 — Approval
# ===========================================================================

@pytest.mark.django_db
def test_approve_creates_approval_log(dispatch_client, dispatch_user, pending_request, mock_email):
    payload = _approve_payload(pending_request)
    response = dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert response.status_code == 200
    assert ApprovalLog.objects.filter(request=pending_request).exists()
    log = ApprovalLog.objects.get(request=pending_request)
    assert log.approver == dispatch_user


@pytest.mark.django_db
def test_approve_sends_approval_email_to_requester(dispatch_client, pending_request, mock_email):
    payload = _approve_payload(pending_request)
    dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert mock_email.call_count == 1
    called_to = mock_email.call_args[0][0]
    assert called_to == pending_request.email


@pytest.mark.django_db
def test_approve_does_not_notify_customer_if_send_updates_false(
    dispatch_client, pending_request, customer, mock_email
):
    """Customer has send_email_updates=False (default). No second email."""
    payload = _approve_payload(pending_request)
    dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert mock_email.call_count == 1


@pytest.mark.django_db
def test_approve_notifies_customer_if_send_updates_true(
    dispatch_client, pending_request, customer_with_updates, mock_email, db
):
    """When send_email_updates=True and customer has an email, a second email is sent."""
    pending_request.customer = customer_with_updates
    pending_request.save()

    payload = _approve_payload(pending_request, send_email_updates=True)
    payload["customer_id"] = str(customer_with_updates.id)
    dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert mock_email.call_count == 2
    recipients = [call[0][0] for call in mock_email.call_args_list]
    assert pending_request.email in recipients
    assert customer_with_updates.email_address in recipients


@pytest.mark.django_db
def test_approve_skips_customer_email_if_no_email_address(
    dispatch_client, pending_request, customer, mock_email
):
    """send_email_updates=True but customer.email_address is empty — no second email."""
    assert customer.email_address == ""
    payload = _approve_payload(pending_request, send_email_updates=True)
    dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert mock_email.call_count == 1


@pytest.mark.django_db
def test_approve_updates_customer_send_email_flag_in_db(
    dispatch_client, pending_request, customer, mock_email
):
    """The Customer.send_email_updates flag is synced to the DB after approval."""
    assert customer.send_email_updates is False
    payload = _approve_payload(pending_request, send_email_updates=True)
    dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    customer.refresh_from_db()
    assert customer.send_email_updates is True


# ===========================================================================
# Branch 2 — Decline
# ===========================================================================

@pytest.mark.django_db
def test_decline_sends_decline_email(dispatch_client, pending_request, mock_email):
    """Setting active=False without cancelled_time triggers a decline email."""
    payload = build_request_payload(pending_request, {"active": False})
    dispatch_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert mock_email.call_count == 1
    subject = mock_email.call_args[0][1]
    assert "Declined" in subject


@pytest.mark.django_db
def test_decline_with_no_email_returns_200(dispatch_client, warehouse, mock_email):
    """Decline on a request with no email address completes without crashing."""
    req = Request.objects.create(
        id=uuid.uuid4(), approved=False, active=True,
        company_name="No Email Co", email=None, warehouse=warehouse,
        ref_number="NO-EMAIL", load_type="Full",
        date_time=timezone.now() + timedelta(days=5), delivery=True,
    )
    payload = build_request_payload(req, {"active": False})
    response = dispatch_client.put(f"/api/request/{req.id}/", payload, format="json")
    assert response.status_code == 200
    assert mock_email.call_count == 0


# ===========================================================================
# Branch 3 — Cancellation
# ===========================================================================

@pytest.mark.django_db
def test_cancel_sets_active_false_in_db(dispatch_client, approved_request, mock_email):
    """After cancellation, active=False is persisted in the DB.
    The update() method calls a second requestUpdate.save() after serializer.save(),
    so we must re-fetch from DB to see the final state."""
    cancelled_at = timezone.now().isoformat().replace("+00:00", "Z")
    payload = build_request_payload(approved_request, {"cancelled_time": cancelled_at})
    response = dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")
    assert response.status_code == 200
    approved_request.refresh_from_db()
    assert approved_request.active is False


@pytest.mark.django_db
def test_cancel_sends_cancellation_email(dispatch_client, approved_request, mock_email):
    cancelled_at = timezone.now().isoformat().replace("+00:00", "Z")
    payload = build_request_payload(approved_request, {"cancelled_time": cancelled_at})
    dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")
    assert mock_email.call_count == 1
    subject = mock_email.call_args[0][1]
    assert "Cancelled" in subject


@pytest.mark.django_db
def test_cancel_does_not_trigger_decline_email(dispatch_client, approved_request, mock_email):
    """Cancellation goes through its own branch; decline email must NOT be sent."""
    cancelled_at = timezone.now().isoformat().replace("+00:00", "Z")
    payload = build_request_payload(approved_request, {"cancelled_time": cancelled_at})
    dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")
    # Only one email (the cancellation one), not the decline email
    assert mock_email.call_count == 1
    subject = mock_email.call_args[0][1]
    assert "Declined" not in subject


# ===========================================================================
# Branch 4 — SMS on dock assignment
# ===========================================================================

@pytest.mark.django_db
def test_first_dock_assignment_sends_sms(
    dispatch_client, request_with_driver, sms_log_consented, mock_email, mock_sms
):
    """Setting dock_number for the first time (was None) sends a dock-door SMS."""
    payload = build_request_payload(request_with_driver, {"dock_number": 3})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert mock_sms.call_count == 1
    body = mock_sms.call_args[0][1]  # send_text(to_number, body)
    assert "dock" in body.lower()


@pytest.mark.django_db
def test_dock_sms_skipped_if_log_no_consent(
    dispatch_client, request_with_driver, mock_email, mock_sms, db
):
    """SmsNumberLog exists but consent=False → no SMS."""
    SmsNumberLog.objects.create(sms_number="+15555550001", consent=False)
    payload = build_request_payload(request_with_driver, {"dock_number": 4})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert mock_sms.call_count == 0


@pytest.mark.django_db
def test_dock_sms_skipped_if_request_sms_consent_false(
    dispatch_client, request_with_driver, sms_log_consented, mock_email, mock_sms
):
    """sms_consent=False on the request → no SMS even if log has consent."""
    payload = build_request_payload(request_with_driver, {"dock_number": 5, "sms_consent": False})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert mock_sms.call_count == 0


@pytest.mark.django_db
def test_dock_sms_skipped_if_no_number_log(
    dispatch_client, request_with_driver, mock_email, mock_sms
):
    """No SmsNumberLog entry for this number → no SMS."""
    payload = build_request_payload(request_with_driver, {"dock_number": 6})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert mock_sms.call_count == 0


@pytest.mark.django_db
def test_container_drop_sends_yard_sms(
    dispatch_client, request_with_driver, sms_log_consented, mock_email, mock_sms, db
):
    """container_drop=True with docked_time newly set sends the yard SMS."""
    request_with_driver.container_drop = True
    request_with_driver.save()
    docked_at = timezone.now().isoformat().replace("+00:00", "Z")
    payload = build_request_payload(request_with_driver, {"docked_time": docked_at})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert mock_sms.call_count == 1
    body = mock_sms.call_args[0][1]  # send_text(to_number, body)
    assert "yard" in body.lower() or "drop" in body.lower()


@pytest.mark.django_db
def test_second_dock_change_does_not_resend_sms(
    dispatch_client, request_with_driver, sms_log_consented, mock_email, mock_sms, db
):
    """Changing dock_number from 1→2 does NOT send another SMS.
    The branch only fires when original dock_number is None."""
    request_with_driver.dock_number = 1
    request_with_driver.save()
    payload = build_request_payload(request_with_driver, {"dock_number": 2})
    dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert mock_sms.call_count == 0


@pytest.mark.django_db
def test_twilio_exception_returns_400(
    dispatch_client, request_with_driver, sms_log_consented, mock_email, mock_sms
):
    """A TwilioRestException from send_text() causes the view to return HTTP 400."""
    from twilio.base.exceptions import TwilioRestException
    mock_sms.side_effect = TwilioRestException(
        status=400, uri="/Messages", msg="Invalid To"
    )
    payload = build_request_payload(request_with_driver, {"dock_number": 7})
    response = dispatch_client.put(f"/api/request/{request_with_driver.id}/", payload, format="json")
    assert response.status_code == 400
    assert "twilio_error" in response.data


# ===========================================================================
# Branch 5 — Driver phone number changes
# ===========================================================================

@pytest.mark.django_db
def test_new_phone_with_consent_creates_log_sends_welcome_sms(
    dispatch_client, approved_request, mock_email, mock_sms
):
    """New phone number + sms_consent=True → SmsNumberLog created + welcome SMS sent."""
    payload = build_request_payload(
        approved_request,
        {"driver_phone_number": "+15559990001", "sms_consent": True},
    )
    dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")
    assert SmsNumberLog.objects.filter(sms_number="+15559990001").exists()
    log = SmsNumberLog.objects.get(sms_number="+15559990001")
    assert log.consent is True
    assert mock_sms.call_count == 1


@pytest.mark.django_db
def test_new_phone_without_consent_creates_log_no_sms(
    dispatch_client, approved_request, mock_email, mock_sms
):
    """New phone number + sms_consent=False → SmsNumberLog created but NO SMS."""
    payload = build_request_payload(
        approved_request,
        {"driver_phone_number": "+15559990002", "sms_consent": False},
    )
    dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")
    assert SmsNumberLog.objects.filter(sms_number="+15559990002", consent=False).exists()
    assert mock_sms.call_count == 0


@pytest.mark.django_db
def test_existing_unconsented_phone_granted_consent_sends_welcome_sms(
    dispatch_client, approved_request, mock_email, mock_sms, db
):
    """Existing SmsNumberLog with consent=False, request now sets sms_consent=True →
    log updated to consent=True and welcome SMS sent."""
    SmsNumberLog.objects.create(sms_number="+15559990003", consent=False)
    # Set the phone number on the request first (simulate prior state)
    approved_request.driver_phone_number = "+15559990003"
    approved_request.sms_consent = False
    approved_request.save()

    payload = build_request_payload(
        approved_request,
        {"driver_phone_number": "+15559990003", "sms_consent": True},
    )
    # Temporarily change the phone to a different value to trigger the branch,
    # then set it back — the branch fires on driver_phone_number change.
    # For this scenario, we simulate changing consent via updating the number field
    # with a fresh record where consent previously was False.
    # Reload the request to reflect current DB state.
    approved_request.refresh_from_db()

    # The "altered_fields" detection compares original vs updated. We need
    # driver_phone_number to appear in altered_fields. Use a brand-new number
    # that hasn't been seen, then verify the unconsented-existing-number path.
    new_number = "+15559990003"
    SmsNumberLog.objects.filter(sms_number=new_number).update(consent=False)

    # Reset request to have a different phone so updating to this one triggers the branch
    approved_request.driver_phone_number = "+10000000000"
    approved_request.save()

    payload = build_request_payload(
        approved_request,
        {"driver_phone_number": new_number, "sms_consent": True},
    )
    dispatch_client.put(f"/api/request/{approved_request.id}/", payload, format="json")

    log = SmsNumberLog.objects.get(sms_number=new_number)
    assert log.consent is True
    assert mock_sms.call_count == 1

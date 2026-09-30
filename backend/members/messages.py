import logging
import os

from django.core.mail import EmailMessage
from django.db import transaction
from twilio.rest import Client

logger = logging.getLogger(__name__)

SENDER = 'appointments@candortransport.com'
REPLY_TO = 'appointments@candortransport.com'


def _log_notification(*, channel, recipient, kind, subject, status, error, appointment):
    """Record a NotificationLog row. Never raises: logging must not block a send."""
    try:
        from .models import NotificationLog
        appointment_id = getattr(appointment, 'pk', appointment)
        with transaction.atomic():
            NotificationLog.objects.create(
                appointment_id=appointment_id,
                channel=channel,
                recipient=str(recipient or '')[:254],
                kind=kind or '',
                subject=str(subject or '')[:255],
                status=status,
                error=error or '',
            )
    except Exception:
        logger.exception('Failed to record %s notification to %s', channel, recipient)


def send_email(to_email, subject, body, *, appointment=None, kind=''):
    try:
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=SENDER,
            to=[to_email],
            reply_to=[REPLY_TO],
        )
        email.content_subtype = 'html'
        email.send(fail_silently=False)
    except Exception as e:
        print(e)
        _log_notification(channel='email', recipient=to_email, kind=kind, subject=subject,
                          status='failed', error=str(e), appointment=appointment)
    else:
        _log_notification(channel='email', recipient=to_email, kind=kind, subject=subject,
                          status='sent', error='', appointment=appointment)


def send_text(to_number, body, *, appointment=None, kind=''):
    try:
        client = Client(os.getenv('TWILIO_ACCOUNT_SID'),
                        os.getenv('TWILIO_AUTH_TOKEN'))
        message = client.messages.create(
            body=body,
            from_=os.getenv('TWILIO_PHONE_NUMBER'),
            to=to_number
        )
    except Exception as e:
        _log_notification(channel='sms', recipient=to_number, kind=kind, subject='',
                          status='failed', error=str(e), appointment=appointment)
        raise
    _log_notification(channel='sms', recipient=to_number, kind=kind, subject='',
                      status='sent', error='', appointment=appointment)
    print(message.sid)

import os
from django.core.mail import EmailMessage
from twilio.rest import Client

SENDER = 'appointments@candortransport.com'
REPLY_TO = 'appointments@candortransport.com'


def send_email(to_email, subject, body):
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


def send_text(to_number, body):
    client = Client(os.getenv('TWILIO_ACCOUNT_SID'),
                    os.getenv('TWILIO_AUTH_TOKEN'))
    message = client.messages.create(
        body=body,
        from_=os.getenv('TWILIO_PHONE_NUMBER'),
        to=to_number
    )
    print(message.sid)

import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from twilio.rest import Client


def send_email(to_email, subject, body):
    SENDER = 'candor.scheduling@gmail.com'
    message = Mail(
        from_email=SENDER,
        to_emails=to_email,
        subject=subject,
        html_content=F'<body>{body}</body>'
    )
    try:
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        print(response.status_code)
        print(response.body)
        print(response.headers)
    except Exception as e:
        print(e)
        message = None


def send_text(to_number, body):
    client = Client(os.getenv('TWILIO_ACCOUNT_SID'),
                    os.getenv('TWILIO_AUTH_TOKEN'))
    message = client.messages.create(
        body=body,
        from_=os.getenv('TWILIO_PHONE_NUMBER'),
        to=to_number
    )
    print(message.sid)

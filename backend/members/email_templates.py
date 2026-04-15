def get_email_header():
    """Returns the email header with Candor logo and styling"""
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
            }
            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .email-header {
                background-color: #1976d2;
                padding: 20px;
                text-align: center;
            }
            .email-header img {
                max-width: 200px;
                height: auto;
            }
            .email-body {
                padding: 30px;
            }
            .email-body h1 {
                color: #1976d2;
                font-size: 24px;
                margin-top: 0;
            }
            .info-box {
                background-color: #f8f9fa;
                border-left: 4px solid #1976d2;
                padding: 15px;
                margin: 20px 0;
            }
            .info-box strong {
                color: #1976d2;
            }
            .alert-box {
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
            }
            .success-box {
                background-color: #d4edda;
                border-left: 4px solid #28a745;
                padding: 15px;
                margin: 20px 0;
            }
            .email-footer {
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #666666;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <img src="https://img1.wsimg.com/isteam/ip/f69d92aa-cce5-4851-89e5-56380f14d8f1/candorlogo.png/:/rs=h:75,cg:true,m/qt=q:100/ll" alt="Candor Logistics Logo">
            </div>
            <div class="email-body">
    '''
    # <p > &copy 2026 Candor Logistics. All rights reserved. < /p >
def get_email_footer():
    """Returns the email footer"""
    return '''
            </div>
            <div class="email-footer">
                <p>This is an automated message from Candor Logistics CT-Scheduling System.</p>
                <p>Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    '''

def appointment_approved_email_template(ref_number, date_time):
    """Template for appointment approval notification to customer"""
    return f'''
    {get_email_header()}
        <h1>Appointment Request Approved</h1>
        <p>Your appointment request has been approved. Please review details below.</p>
        
        <div class="success-box">
            <p><strong>Reference Number:</strong> {ref_number}</p>
            <p><strong>Date Time:</strong> {date_time}</p>
        </div>
        
        <p>Please email <a href="mailto:appointments@candortransport.com">appointments@candortransport.com</a> with any questions or concerns.</p>
        
        <p>Thank you for choosing Candor Logistics.</p>
    {get_email_footer()}
    '''

def calendar_event_confirmation_email_template(ref_number, company_name, date_time):
    """Template for calendar event confirmation"""
    return f'''
    {get_email_header()}
        <h1>New Appointment Created</h1>
        <p>A new appointment has been created. Please review.</p>
        
        <div class="info-box">
            <p><strong>Reference Number:</strong> {ref_number}</p>
            <p><strong>Customer:</strong> {company_name}</p>
            <p><strong>Date Time:</strong> {date_time}</p>
        </div>
    {get_email_footer()}
    '''

def new_request_email_template(ref_number, company_name, date_time):
    """Template for new pending request notification to team"""
    return f'''
    {get_email_header()}
        <h1>New Pending Request</h1>
        <p>A new request is now pending. Please review.</p>
        
        <div class="alert-box">
            <p><strong>Reference Number:</strong> {ref_number}</p>
            <p><strong>Customer:</strong> {company_name}</p>
            <p><strong>Date Time:</strong> {date_time}</p>
        </div>
    {get_email_footer()}
    '''

def customer_appointment_email_template(ref_number, company_name, date_time):
    """Template for notifying a customer of their scheduled appointment"""
    return f'''
    {get_email_header()}
        <h1>Appointment Scheduled</h1>
        <p>An appointment has been scheduled for your account. Please review the details below.</p>

        <div class="success-box">
            <p><strong>Reference Number:</strong> {ref_number}</p>
            <p><strong>Carrier:</strong> {company_name}</p>
            <p><strong>Date &amp; Time:</strong> {date_time}</p>
        </div>

        <p>Please email <a href="mailto:appointments@candortransport.com">appointments@candortransport.com</a> with any questions or concerns.</p>

        <p>Thank you for choosing Candor Logistics.</p>
    {get_email_footer()}
    '''

def appointment_declined_email_template(ref_number, date_time):
    """Template for notifying the submitter that their request was declined"""
    return f'''
    {get_email_header()}
        <h1>Appointment Request Declined</h1>
        <p>Unfortunately, your appointment request has been declined.</p>

        <div class="alert-box">
            <p><strong>Reference Number:</strong> {ref_number}</p>
            <p><strong>Date &amp; Time:</strong> {date_time}</p>
        </div>

        <p>Please email <a href="mailto:appointments@candortransport.com">appointments@candortransport.com</a> to discuss alternative arrangements.</p>

        <p>Thank you for choosing Candor Logistics.</p>
    {get_email_footer()}
    '''

def appointment_cancelled_email_template(ref_number, date_time):
    """Template for notifying the submitter that their appointment was cancelled"""
    return f'''
    {get_email_header()}
        <h1>Appointment Cancelled</h1>
        <p>Your appointment has been cancelled.</p>

        <div class="alert-box">
            <p><strong>Reference Number:</strong> {ref_number}</p>
            <p><strong>Date &amp; Time:</strong> {date_time}</p>
        </div>

        <p>Please email <a href="mailto:appointments@candortransport.com">appointments@candortransport.com</a> to reschedule or discuss alternative arrangements.</p>

        <p>Thank you for choosing Candor Logistics.</p>
    {get_email_footer()}
    '''

def request_confirmation_email_template(ref_number, date_time):
    """Template for customer request confirmation"""
    return f'''
    {get_email_header()}
        <h1>Appointment Request Confirmation</h1>
        <p>Your appointment request has been received. Please allow 24 hours for approval.</p>
        
        <div class="info-box">
            <p><strong>Reference Number:</strong> {ref_number}</p>
            <p><strong>Date Time:</strong> {date_time}</p>
        </div>
        
        <p>Email <a href="mailto:appointments@candortransport.com">appointments@candortransport.com</a> for any issues.</p>
        
        <p>Thank you for choosing Candor Logistics.</p>
    {get_email_footer()}
    '''
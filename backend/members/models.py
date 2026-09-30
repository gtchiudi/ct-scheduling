# Each class here is a db table. How to make them link with keys?
from django.db import models
import uuid
from django.contrib.auth.models import User, Group
from django.utils import timezone


class BaseModel(models.Model):
    active = models.BooleanField(default=True)

    def delete(self, using=None, keep_parents=False):
        self.active = False
        self.save()

    class Meta:
        abstract = True
# The above base model allows us to soft delete objects by setting active to false


class Warehouse(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64)
    address = models.CharField(max_length=256)
    phone_number = models.CharField(max_length=12)
    timezone = models.CharField(max_length=64, default='America/New_York')
    color = models.CharField(max_length=7, default="#02B40B")  # Hex color code
    appointments_per_slot = models.IntegerField(default=1)
    active = models.BooleanField(default=True)

    def __str__(self):
        if (self.active):
            return self.name
        else:
            return "inactive"


class Request(BaseModel):
    LOAD_CHOICES = (
        ('Full', 'Full'),
        ('LTL', 'LTL'),
        ('Container', 'Container'),
    )

    LOAD_CONFIG_CHOICES = (
        ('Palletized', 'Palletized'),
        ('Floor Loaded', 'Floor Loaded'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    approved = models.BooleanField(default=False)
    company_name = models.CharField(
        max_length=255)  # changeable only via admin
    customer_name = models.CharField(max_length=255, null=True, blank=True)
    customer = models.ForeignKey(
        'Customer', null=True, blank=True, on_delete=models.SET_NULL)
    phone_number = models.CharField(
        max_length=12, null=True, blank=True)  # changeable only via admin
    email = models.EmailField(max_length=254, null=True, blank=True)  # changeable only via admin
    # Cannot be changed unless loged in as admin
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.CASCADE)  # changeable via emp
    # warehouse = models.CharField(foreign_key=True, Warehouse, on_delete=models.Cascade)
    ref_number = models.TextField(default="")  # changable via emp; semicolon-delimited list of up to 10
    load_type = models.CharField(
        max_length=32, choices=LOAD_CHOICES, default='Full')  # changable via emp
    container_drop = models.BooleanField(
        default=False, blank=True)  # changable via emp
    container_number = models.CharField(
        max_length=32, null=True, blank=True)  # changeable via emp
    note_section = models.CharField(
        max_length=512, null=True, blank=True)  # changable via emp
    date_time = models.DateTimeField("Request Date")  # changable via emp
    appointment_length = models.IntegerField(default=15)
    delivery = models.BooleanField(default=False)  # changable via emp
    # How the freight is loaded. Deliveries only; null on pickups and on every
    # appointment created before this field existed.
    load_config = models.CharField(
        max_length=32, choices=LOAD_CONFIG_CHOICES, null=True,
        blank=True)  # changable via emp
    # Initial Request
    trailer_number = models.CharField(
        max_length=32, null=True, blank=True)  # employee use only
    # For aprroving Requests (Trailer is nor req.)
    driver_phone_number = models.CharField(
        max_length=12, null=True, blank=True)  # emp use only
    sms_consent = models.BooleanField(default=False)  # emp use only
    # Once truck arrives
    dock_number = models.IntegerField(null=True, blank=True)  # emp use only
    check_in_time = models.DateTimeField(
        "Checked In", null=True, blank=True)  # emp use only
    # Logged once driver number is assigned. Dock number is added manually. Notify driver via button
    docked_time = models.DateTimeField(
        "Docked Time", null=True, blank=True)  # emp use only
    completed_time = models.DateTimeField(
        "Time Completed", null=True, blank=True)  # emp use only
    cancelled_time = models.DateTimeField(
        'Cancelled At', null=True, blank=True
    )
    # Last two are done with buttons and auto added to DB
    active = models.BooleanField(default=True)
    # BEcomes false after completed delivery
    # Audit metadata. Null on rows created before these fields existed, and
    # created_by is null for requests submitted through the public form.
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='created_requests')
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['active', 'approved', 'date_time'], name='request_active_approved_dt_idx'),
            models.Index(fields=['date_time'], name='request_date_time_idx'),
        ]

class Customer(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_name = models.CharField(max_length=255)
    email_address = models.EmailField(max_length=254, null=True, blank=True, default='')
    send_email_updates = models.BooleanField(default=False)
    active = models.BooleanField(default=True)

class ApprovalLog(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    approver = models.ForeignKey(
        User, null=True, on_delete=models.SET_NULL)
    request = models.ForeignKey(
        Request, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)


class SmsNumberLog(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sms_number = models.CharField(max_length=12)
    consent = models.BooleanField(default=False)
    active = models.BooleanField(default=True)


class AppointmentEvent(models.Model):
    """One thing that happened to an appointment, and who did it.

    Rows are written by RequestView (see members/audit.py) and never edited.
    occurred_at is null only for approvals imported from ApprovalLog, whose
    date was never recorded.
    """
    ACTION_CHOICES = (
        ('created', 'Created'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
        ('edited', 'Edited'),
        ('checked_in', 'Checked in'),
        ('docked', 'Docked'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment = models.ForeignKey(
        Request, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='appointment_events')
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    # Edits only: {"field": [old, new]}
    changes = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(
        null=True, blank=True, db_index=True, default=timezone.now)

    class Meta:
        ordering = [models.F('occurred_at').desc(nulls_last=True)]
        indexes = [
            models.Index(fields=['appointment', 'occurred_at'],
                         name='apptevent_appt_occurred_idx'),
        ]

    def __str__(self):
        return f'{self.action} {self.appointment_id} @ {self.occurred_at}'


class NotificationLog(models.Model):
    """Every email and text the app tried to send, and whether it went out.

    Written by members.messages.send_email / send_text.
    """
    CHANNEL_CHOICES = (
        ('email', 'Email'),
        ('sms', 'SMS'),
    )
    KIND_CHOICES = (
        ('new_request', 'New request (to team)'),
        ('request_confirmation', 'Request confirmation'),
        ('calendar_event', 'New calendar event (to team)'),
        ('customer_scheduled', 'Appointment scheduled (to customer)'),
        ('approval', 'Approval'),
        ('decline', 'Decline'),
        ('cancellation', 'Cancellation'),
        ('dock_ready', 'Dock ready (SMS)'),
        ('yard_drop', 'Yard drop (SMS)'),
        ('sms_subscribed', 'SMS subscribed'),
    )
    STATUS_CHOICES = (
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment = models.ForeignKey(
        Request, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='notifications')
    channel = models.CharField(max_length=8, choices=CHANNEL_CHOICES)
    recipient = models.CharField(max_length=254)
    kind = models.CharField(max_length=32, choices=KIND_CHOICES, blank=True)
    subject = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=8, choices=STATUS_CHOICES)
    error = models.TextField(blank=True)
    sent_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f'{self.channel} {self.kind} to {self.recipient} ({self.status})'

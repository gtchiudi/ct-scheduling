# Each class here is a db table. How to make them link with keys?
from django.db import models
import uuid
from django.contrib.auth.models import User, Group


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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    approved = models.BooleanField(default=False)
    company_name = models.CharField(
        max_length=255)  # changeable only via admin
    phone_number = models.CharField(
        max_length=12, null=True, blank=True)  # changeable only via admin
    email = models.EmailField(max_length=254)  # changeable only via admin
    # Cannot be changed unless loged in as admin
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.CASCADE)  # changeable via emp
    # warehouse = models.CharField(foreign_key=True, Warehouse, on_delete=models.Cascade)
    ref_number = models.CharField(
        default=0, max_length=20)  # changable via emp
    load_type = models.CharField(
        max_length=32, choices=LOAD_CHOICES, default='Full')  # changable via emp
    container_drop = models.BooleanField(
        default=False, blank=True)  # changable via emp
    container_number = models.CharField(
        max_length=32, null=True, blank=True)  # changeable via emp
    note_section = models.CharField(
        max_length=512, null=True, blank=True)  # changable via emp
    date_time = models.DateTimeField("Request Date")  # changable via emp
    delivery = models.BooleanField(default=False)  # changable via emp
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
    # Last two are done with buttons and auto added to DB
    active = models.BooleanField(default=True)
    # BEcomes false after completed delivery


class Schedule(BaseModel):
    approver = models.ForeignKey(
        User, null=True, on_delete=models.SET_NULL)
    request = models.ForeignKey(
        Request, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)

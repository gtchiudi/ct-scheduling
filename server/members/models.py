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
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.CASCADE)  # changeable via emp
    po_number = models.IntegerField(default=0)  # changable via emp
    load_type = models.CharField(
        max_length=32, choices=LOAD_CHOICES, default='Full')  # changable via emp
    container_number = models.IntegerField(
        null=True, blank=True)  # changeable via emp
    note_section = models.CharField(
        max_length=512, null=True, blank=True)  # changable via emp
    date_time = models.DateTimeField("Request Date")  # changable via emp
    delivery = models.BooleanField(default=False)  # changable via emp
    trailer_number = models.CharField(
        max_length=32, null=True, blank=True)  # employee use only
    driver_phone_number = models.CharField(
        max_length=12, null=True, blank=True)  # emp use only
    dock_number = models.IntegerField(null=True, blank=True)  # emp use only
    check_in_time = models.TimeField(
        "Checked In", null=True, blank=True)  # emp use only
    docked_time = models.TimeField(
        "Docked Time", null=True, blank=True)  # emp use only
    completed_time = models.TimeField(
        "Time Completed", null=True, blank=True)  # emp use only
    active = models.BooleanField(default=True)


class Schedule(BaseModel):
    approver = models.ForeignKey(
        User, null=True, on_delete=models.SET_NULL)
    request = models.ForeignKey(
        Request, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)

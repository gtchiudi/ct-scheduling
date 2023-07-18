# Each class here is a db table. How to make them link with keys?
from django.db import models
import uuid


class BaseModel(models.Model):
    active = models.BooleanField(default=True)

    def delete(self, using=None, keep_parents=False):
        self.active = False
        self.save()

    class Meta:
        abstract = True


class Request(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    approved = models.BooleanField(default=False)
    company_name = models.CharField(
        max_length=255)  # changeable only via admin
    phone_number = models.CharField(
        max_length=12, null=True)  # changeable only via admin
    email = models.CharField(max_length=255)  # changeable only via admin
    po_number = models.IntegerField(default=0)  # changable via emp
    load_type = models.CharField(max_length=32)  # changable via emp
    container_number = models.IntegerField(default=0)  # changeable via emp
    note_section = models.CharField(
        max_length=512, null=True)  # changable via emp
    date_time = models.DateTimeField("Request Date")  # changable via emp
    delivery = models.BooleanField(default=False)  # changable via emp
    trailer_number = models.IntegerField(default=0)  # employee use only
    driver_phone_number = models.CharField(
        max_length=12, null=True)  # emp use only
    dock_number = models.IntegerField(default=0)  # emp use only
    check_in_time = models.TimeField("Checked In", null=True)  # emp use only
    docked_time = models.TimeField("Docked Time", null=True)  # emp use only
    completed_time = models.TimeField(
        "Time Completed", null=True)  # emp use only
    active = models.BooleanField(default=True)


class Employee(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=12)
    password = models.CharField(max_length=32)
    active = models.BooleanField(default=True)


class Role(BaseModel):
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE)
    role = models.CharField(max_length=32)
    active = models.BooleanField(default=True)


class Warehouse(BaseModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64)
    address = models.CharField(max_length=256)
    phone_number = models.CharField(max_length=12)
    active = models.BooleanField(default=True)


class ActionsLog(BaseModel):
    employee = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=256)
    date_time = models.DateTimeField("Action Date/Time")
    active = models.BooleanField(default=True)


class Schedule(BaseModel):
    approver = models.ForeignKey(
        Employee, null=True, on_delete=models.SET_NULL)
    request = models.ForeignKey(
        Request, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)

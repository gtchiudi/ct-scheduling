# Each class here is a db table. How to make them link with keys?
from django.db import models


class Request(models.Model):
    request_id = models.IntegerField(primary_key=True, default=0)
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


class Employee(models.Model):
    emp_id = models.IntegerField(primary_key=True, default=0)
    email = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=12)
    password = models.CharField(max_length=32)
    active = models.BooleanField(default=True)


class Role(models.Model):
    emp_id = models.ForeignKey(Employee, on_delete=models.CASCADE)
    role = models.CharField(max_length=32)
    active = models.BooleanField(default=True)


class Warehouse(models.Model):
    warehouse_id = models.IntegerField(primary_key=True, default=0)
    name = models.CharField(max_length=64)
    address = models.CharField(max_length=256)
    phone_number = models.CharField(max_length=12)
    active = models.BooleanField(default=True)


class Actions_Log(models.Model):
    emp_id = models.ForeignKey(Employee, on_delete=models.CASCADE)
    action = models.CharField(max_length=256)
    date_time = models.DateTimeField("Action Date/Time")
    active = models.BooleanField(default=True)


class Schedule(models.Model):
    approver = models.ForeignKey(Employee, on_delete=models.CASCADE)
    request_id = models.ForeignKey(
        Request, on_delete=models.CASCADE)
    warehouse_id = models.ForeignKey(
        Warehouse, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)

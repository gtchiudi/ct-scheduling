# Each class here is a db table. How to make them link with keys?
from django.db import models


class Request(models.Model):
    request_id = models.IntegerField(default=0)
    approved = models.BooleanField(default=False)
    company_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=12)
    po_number = models.IntegerField(default=0)
    container_number = models.IntegerField(default=0)
    outbound_number = models.IntegerField(default=0)
    reference_number = models.IntegerField(default=0)
    note_section = models.CharField(max_length=512)
    date_time = models.DateTimeField("Request Date")


class Employee(models.Model):
    emp_id = models.IntegerField(default=0)
    email = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=12)
    password = models.CharField(max_length=32)


class Role(models.Model):
    emp_id = models.ForeignKey(Employee.emp_id)
    role = models.CharField(max_length=32)


class Warehouse(models.Model):
    warehouse_id = models.CharField(default=0)
    name = models.CharField(max_length=64)
    address = models.CharField(max_length=256)
    phone_number = models.CharField(max_length=12)


class Actions_Log(models.Model):
    emp_id = models.ForeignKey(Employee.emp_id)
    action = models.CharField(max_length=256)
    date_time = models.DateTimeField("Action Date/Time")


class Schedule(models.Model):
    approver = models.ForeignKey(Employee.emp_id)
    request_id = models.ForeignKey(Request.request_id)
    warehouse_id = models.ForeignKey(Warehouse.warehouse_id)

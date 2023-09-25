from rest_framework import serializers
from .models import *
from django.contrib.auth.models import User, Group


class RequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ('id', 'approved', 'company_name', 'phone_number',
                  'email', 'warehouse', 'po_number', 'load_type', 'container_number',
                  'note_section', 'date_time', 'delivery', 'trailer_number',
                  'driver_phone_number', 'dock_number', 'check_in_time', 'docked_time',
                  'completed_time', 'active')


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ('id', 'name', 'email', 'phone_number', 'password', 'active')


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ('employee', 'action', 'date_time', 'active')


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ('id', 'name', 'address', 'phone_number', 'active')


class ActionsLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionsLog
        fields = ('employee', 'action', 'date_time', 'active')


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = ('approver', 'request', 'active')


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'groups')


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ('id', 'name')

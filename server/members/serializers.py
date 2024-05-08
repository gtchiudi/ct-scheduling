from rest_framework import serializers
from .models import *
from django.contrib.auth.models import User, Group


class RequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ('id', 'approved', 'company_name', 'phone_number',
                  'email', 'warehouse', 'ref_number', 'load_type', 'container_drop', 'container_number',
                  'note_section', 'date_time', 'delivery', 'trailer_number',
                  'driver_phone_number', 'sms_consent', 'dock_number', 'check_in_time', 'docked_time',
                  'completed_time', 'active')


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ('id', 'name', 'address', 'phone_number')


# class ApprovalLog(serializers.ModelSerializer):
#     class Meta:
#         model = ApprovalLog
#         fields = ('approver', 'request')


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'groups')


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ('id', 'name')

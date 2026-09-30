from rest_framework import serializers
from .models import *
from django.contrib.auth.models import User, Group


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ('id', 'customer_name', 'email_address', 'send_email_updates')


class RequestSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        source='customer',
        write_only=True,
        allow_null=True,
        required=False,
    )
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        user = obj.created_by
        if user is None:
            return None
        return user.get_full_name() or user.username

    class Meta:
        model = Request
        fields = ('id', 'approved', 'company_name', 'customer_name', 'customer', 'customer_id',
                  'phone_number', 'email', 'warehouse', 'ref_number', 'load_type', 'container_drop',
                  'container_number', 'note_section', 'date_time', 'appointment_length', 'delivery', 'load_config', 'trailer_number',
                  'driver_phone_number', 'sms_consent', 'dock_number', 'check_in_time', 'docked_time',
                  'completed_time', 'cancelled_time', 'active',
                  'created_by', 'created_by_name', 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')


class SlotSerializer(serializers.ModelSerializer):
    """Taken time slots for the public request form: no customer data."""
    class Meta:
        model = Request
        fields = ('warehouse', 'date_time', 'appointment_length')


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ('id', 'name', 'address', 'phone_number', 'timezone', 'color', 'appointments_per_slot')


class ApprovalLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalLog
        fields = ('id', 'approver', 'request')


class UserSerializer(serializers.ModelSerializer):
    # No password field: it exposed every user's password hash, and writes
    # stored raw text rather than a hash. Passwords are set in the Django admin.
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'groups')


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ('id', 'name')

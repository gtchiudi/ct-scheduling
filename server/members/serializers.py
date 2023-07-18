from rest_framework import serializers
from .models import *


class RequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ('id', 'approved', 'company_name', 'phone_number',
                  'email', 'po_number', 'load_type', 'container_number',
                  'note_section', 'date_time', 'delivery', 'trailer_number',
                  'driver_phone_number', 'dock_number', 'check_in_time', 'docked_time',
                  'complete_time', 'active')

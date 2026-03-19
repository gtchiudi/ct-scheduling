from django.shortcuts import render
from django.conf import settings
from rest_framework import viewsets, filters, status
from .serializers import *
from .models import *
from django.contrib.auth.models import User, Group
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Q

from .messages import send_email, send_text
from .email_templates import *

from datetime import datetime

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, permissions

from rest_framework.parsers import JSONParser
from django.forms.models import model_to_dict
from datetime import datetime
import pytz

if settings.DEBUG:
    candorEmailRecipient = 'candor.scheduling@gmail.com'
else:
    candorEmailRecipient = 'appointments@candortransport.com'

class IsAuthenticatedOrPostOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method == 'POST':
            return True  # Allow unauthenticated POST requests
        return IsAuthenticated


class RequestView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticatedOrPostOnly, )

    serializer_class = RequestSerializer
    queryset = Request.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        isApproved = self.request.query_params.get('approved')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date and end_date:
            queryset = queryset.filter(
                date_time__gte=start_date, date_time__lte=end_date)

        queryset = queryset.filter(active=True)

        if isApproved is not None:
            is_approved_bool = isApproved.lower() == 'true'
            queryset = queryset.filter(approved=is_approved_bool)

        return queryset

    def update(self, request, pk, format=None):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            requestUpdate = self.get_object()
        except Request.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        original_data = model_to_dict(requestUpdate)
        serializer = RequestSerializer(requestUpdate, data=request.data)
        if serializer.is_valid():
            serializer.save()
            updated_data = serializer.data
            altered_fields = [
                field for field in original_data if original_data[field] != updated_data[field]]
            if 'approved' in altered_fields and updated_data['approved']:
                approval_log = ApprovalLog(
                    approver=request.user, request=requestUpdate)
                approval_log.save()

                date_time = datetime.fromisoformat(
                    updated_data["date_time"].replace('Z', '+00:00'))
                date_time = date_time.astimezone(
                    pytz.timezone('America/New_York'))
                send_email(
                    updated_data['email'],
                    'Appointment Request Approved',
                    appointment_approved_email_template(
                        updated_data["ref_number"],
                        date_time.strftime('%Y-%m-%d %H:%M:%S')
                    ))

            elif 'dock_number' in altered_fields:
                number_log = SmsNumberLog.objects.filter(
                    sms_number=updated_data['driver_phone_number'])
                if number_log.exists() and number_log[0].consent:
                    send_text(updated_data['driver_phone_number'],
                              F'''Thank you for choosing Candor Logistics.
Please slide tandems back.
Proceed to dock door {updated_data['dock_number']}.
Candor Logistics does not send marketing messages.

Reply 'STOP' to opt out of future notifications.''')

            elif 'driver_phone_number' in altered_fields:
                number_log = SmsNumberLog.objects.filter(
                    sms_number=updated_data['driver_phone_number'])
                consent = updated_data['sms_consent']
                if number_log.exists() and not number_log[0].consent and consent:
                    SmsNumberLog.objects.filter(
                        sms_number=updated_data['driver_phone_number']).update(consent=True)

                elif not number_log.exists():
                    SmsNumberLog.objects.create(
                        sms_number=updated_data['driver_phone_number'], consent=updated_data['sms_consent'])

                number_log = SmsNumberLog.objects.filter(
                    sms_number=updated_data['driver_phone_number'])

                if number_log.exists() and number_log[0].consent:
                    send_text(updated_data['driver_phone_number'],
                              F'''Thank you for choosing Candor Logistics.
You have subscribed to receive recurring appointment notifications via SMS.
Message and data rates may apply.
Candor Logistics will not sent marketing messages.
Please wait for further instructions.

Reply 'STOP' to opt out of future notifications.''')
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if request.data['approved']:  # created from the calendar page
            date_time = datetime.fromisoformat(
                request.data["date_time"].replace('Z', '+00:00'))
            date_time = date_time.astimezone(
                pytz.timezone('America/New_York'))
            send_email(
                candorEmailRecipient,
                'New Calendar Event Confirmation',
                calendar_event_confirmation_email_template(
                    request.data["ref_number"],
                    request.data["company_name"],
                    date_time.strftime('%Y-%m-%d %H:%M:%S')
                ))

        else:  # created from the request page
            date_time = datetime.fromisoformat(
                request.data["date_time"].replace('Z', '+00:00'))
            date_time = date_time.astimezone(
                pytz.timezone('America/New_York'))
            send_email(  # to sales team
                candorEmailRecipient,
                'New Pending Request',
                new_request_email_template(
                    request.data["ref_number"],
                    request.data["company_name"],
                    date_time.strftime('%Y-%m-%d %H:%M:%S')
                ))

            send_email(  # to customer
                request.data['email'],
                'Appointment Request Confirmation',
                request_confirmation_email_template(
                    request.data["ref_number"],
                    date_time.strftime('%Y-%m-%d %H:%M:%S')
                ))

        return response


class WarehouseView(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    queryset = Warehouse.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class ApprovalLogView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, )
    serializer_class = ApprovalLog
    queryset = ApprovalLog.objects.all()


class UserView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, )
    serializer_class = UserSerializer
    queryset = User.objects.all()


class GroupView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, )
    serializer_class = GroupSerializer
    queryset = Group.objects.all()


class UserGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = list(request.user.groups.values_list('name', flat=True))
        return Response({'groups': groups})

class PendingRequestStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get count of pending requests (not approved and active)
        pending_count = Request.objects.filter(
            approved=False,
            active=True
        ).count()
        
        # Check if there are requests for today or older
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        has_urgent_requests = Request.objects.filter(
            approved=False,
            active=True,
            date_time__lte=now  # Requests on or before current time
        ).exists()
        
        return Response({
            'pending_count': pending_count,
            'has_urgent_requests': has_urgent_requests
        })
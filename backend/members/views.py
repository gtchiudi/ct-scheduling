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
from twilio.base.exceptions import TwilioRestException
from .email_templates import (
    appointment_approved_email_template,
    appointment_cancelled_email_template,
    calendar_event_confirmation_email_template,
    new_request_email_template,
    request_confirmation_email_template,
    customer_appointment_email_template,
    appointment_declined_email_template,
)

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
            # Sync send_email_updates to the Customer record if provided
            send_email_updates = request.data.get('send_email_updates')
            if send_email_updates is not None and updated_data.get('customer'):
                Customer.objects.filter(id=updated_data['customer']['id']).update(
                    send_email_updates=send_email_updates
                )
            # Normalize datetime fields to strings before comparing to avoid
            # false positives from model_to_dict (datetime) vs serializer (ISO string)
            datetime_fields = ['date_time', 'check_in_time', 'docked_time', 'completed_time', 'cancelled_time']
            normalized_original = {
                k: v.isoformat() if hasattr(v, 'isoformat') else v
                for k, v in original_data.items()
            }
            normalized_updated = {
                k: v.replace('Z', '+00:00') if isinstance(v, str) and k in datetime_fields and v else v
                for k, v in updated_data.items()
            }
            altered_fields = [
                field for field in normalized_original
                if normalized_original[field] != normalized_updated.get(field)]
            if 'approved' in altered_fields and updated_data['approved']:
                approval_log = ApprovalLog(
                    approver=request.user, request=requestUpdate)
                approval_log.save()

                date_time = datetime.fromisoformat(
                    updated_data["date_time"].replace('Z', '+00:00'))
                date_time = date_time.astimezone(
                    pytz.timezone('America/New_York'))
                date_time_str = date_time.strftime('%Y-%m-%d %H:%M:%S')

                send_email(
                    updated_data['email'],
                    'Appointment Request Approved',
                    appointment_approved_email_template(
                        updated_data["ref_number"],
                        date_time_str,
                        updated_data.get("delivery", False),
                    ))

                # Notify customer if send_email_updates is set and customer has an email
                customer_data = updated_data.get('customer')
                send_updates = request.data.get('send_email_updates', False)
                if send_updates and customer_data and customer_data.get('email_address'):
                    send_email(
                        customer_data['email_address'],
                        'Appointment Scheduled',
                        customer_appointment_email_template(
                            updated_data["ref_number"],
                            updated_data["company_name"],
                            date_time_str,
                            updated_data.get("delivery", False),
                        ))

            elif 'active' in altered_fields and not updated_data['active'] and not updated_data.get('cancelled_time'):
                # Declined (active set to false without a cancelled_time — from Decline button)
                date_time = datetime.fromisoformat(
                    updated_data["date_time"].replace('Z', '+00:00'))
                date_time = date_time.astimezone(
                    pytz.timezone('America/New_York'))
                if updated_data.get('email'):
                    send_email(
                        updated_data['email'],
                        'Appointment Request Declined',
                        appointment_declined_email_template(
                            updated_data["ref_number"],
                            date_time.strftime('%Y-%m-%d %H:%M:%S'),
                            updated_data.get("delivery", False),
                        ))

            elif 'cancelled_time' in altered_fields:
                requestUpdate.active = False
                requestUpdate.save()

                if updated_data.get('email'):
                    date_time = datetime.fromisoformat(
                        updated_data["date_time"].replace('Z', '+00:00'))
                    date_time = date_time.astimezone(
                        pytz.timezone('America/New_York'))
                    send_email(
                        updated_data['email'],
                        'Appointment Cancelled',
                        appointment_cancelled_email_template(
                            updated_data["ref_number"],
                            date_time.strftime('%Y-%m-%d %H:%M:%S'),
                            updated_data.get("delivery", False),
                        ))


            elif (original_data.get('dock_number') is None and updated_data.get('dock_number') is not None) or \
                    (original_data.get('docked_time') is None and updated_data.get('docked_time') is not None and updated_data['container_drop']):
                number_log = SmsNumberLog.objects.filter(
                    sms_number=updated_data['driver_phone_number'])
                if number_log.exists() and number_log[0].consent and updated_data['sms_consent']:
                    try:
                        if updated_data['container_drop']:
                            send_text(updated_data['driver_phone_number'],
                                    F'''Thank you for choosing Candor Logistics.
Please drop in the yard.
Candor Logistics does not send marketing messages.

Reply 'STOP' to opt out of future notifications.''')
                        else:
                            send_text(updated_data['driver_phone_number'],
                                  F'''Thank you for choosing Candor Logistics.
Please slide tandems back.
Proceed to dock door {updated_data['dock_number']}.
Candor Logistics does not send marketing messages.

Reply 'STOP' to opt out of future notifications.''')
                    except TwilioRestException as e:
                        return Response({"twilio_error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            elif 'driver_phone_number' in altered_fields:
                number_log = SmsNumberLog.objects.filter(
                    sms_number=updated_data['driver_phone_number'])
                consent = updated_data['sms_consent']
                should_send_sms = False
                if number_log.exists() and not number_log[0].consent and consent:
                    # Consent was just granted for an existing number
                    SmsNumberLog.objects.filter(
                        sms_number=updated_data['driver_phone_number']).update(consent=True)
                    should_send_sms = True
                elif not number_log.exists():
                    # New number — only send if consent is given
                    SmsNumberLog.objects.create(
                        sms_number=updated_data['driver_phone_number'], consent=updated_data['sms_consent'])
                    should_send_sms = consent

                number_log = SmsNumberLog.objects.filter(
                    sms_number=updated_data['driver_phone_number'])

                if should_send_sms and number_log.exists() and number_log[0].consent and updated_data['sms_consent']:
                    try:
                        send_text(updated_data['driver_phone_number'],
                                  F'''Thank you for choosing Candor Logistics.
You have subscribed to receive recurring appointment notifications via SMS.
Message and data rates may apply.
Candor Logistics will not sent marketing messages.
Please wait for further instructions.

Reply 'STOP' to opt out of future notifications.''')
                    except TwilioRestException as e:
                        return Response({"twilio_error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if request.data['approved']:  # created from the calendar page
            date_time = datetime.fromisoformat(
                request.data["date_time"].replace('Z', '+00:00'))
            date_time = date_time.astimezone(
                pytz.timezone('America/New_York'))
            date_time_str = date_time.strftime('%Y-%m-%d %H:%M:%S')

            send_email(
                candorEmailRecipient,
                'New Calendar Event Confirmation',
                calendar_event_confirmation_email_template(
                    request.data["ref_number"],
                    request.data["company_name"],
                    date_time_str,
                    request.data.get("delivery", False),
                ))

            # Notify customer if send_email_updates and customer email provided
            customer_id = request.data.get('customer_id')
            send_updates = request.data.get('send_email_updates', False)
            if send_updates and customer_id:
                try:
                    customer = Customer.objects.get(id=customer_id)
                    if customer.email_address:
                        send_email(
                            customer.email_address,
                            'Appointment Scheduled',
                            customer_appointment_email_template(
                                request.data["ref_number"],
                                request.data["company_name"],
                                date_time_str,
                                request.data.get("delivery", False),
                            ))
                except Customer.DoesNotExist:
                    pass

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
                    date_time.strftime('%Y-%m-%d %H:%M:%S'),
                    request.data.get("delivery", False),
                ))

            send_email(  # to customer
                request.data['email'],
                'Appointment Request Confirmation',
                request_confirmation_email_template(
                    request.data["ref_number"],
                    date_time.strftime('%Y-%m-%d %H:%M:%S'),
                    request.data.get("delivery", False),
                ))

        return response


class WarehouseView(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    queryset = Warehouse.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

class CustomerView(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = CustomerSerializer
    queryset = Customer.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['customer_name']


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
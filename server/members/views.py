from django.shortcuts import render
from rest_framework import viewsets, filters, status
from .serializers import *
from .models import *
from django.contrib.auth.models import User, Group

from .emails import send_email

from datetime import datetime

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, permissions

from rest_framework.parsers import JSONParser
from django.forms.models import model_to_dict
from datetime import datetime
import pytz


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
        print('put request')
        try:
            requestUpdate = self.get_object()
        except Request.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        original_data = model_to_dict(requestUpdate)
        print('original data: ', original_data)
        serializer = RequestSerializer(requestUpdate, data=request.data)
        if serializer.is_valid():
            serializer.save()
            updated_data = serializer.data
            print('updated data: ', updated_data)
            altered_fields = [
                field for field in original_data if original_data[field] != updated_data[field]]
            print(altered_fields)
            if 'approved' in altered_fields and updated_data['approved']:
                date_time = datetime.fromisoformat(
                    updated_data["date_time"].replace('Z', '+00:00'))
                date_time = date_time.astimezone(
                    pytz.timezone('America/New_York'))
                send_email(
                    'candor.scheduling@gmail.com',
                    'Appointment Request Approved',
                    F'''
<pre>Please do not reply to this email.

Your appointment request has been approved. Please review details below.

Appointement Details:
    Reference Number: {updated_data["ref_number"]}
    Date Time: {date_time.strftime('%Y-%m-%d %H:%M:%S')}

Please email sales@candortransport.com with any questions or concerns.

Thank you for choosing Candor Logistics.
</pre>''')
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # eventually send emails to sales@candortransport.com
    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        if request.data['approved']:  # created from the calendar page
            date_time = datetime.fromisoformat(
                request.data["date_time"].replace('Z', '+00:00'))
            date_time = date_time.astimezone(
                pytz.timezone('America/New_York'))
            send_email(
                'candor.scheduling@gmail.com',
                'New Calendar Event Confirmation',
                F'''
<pre>Please do not reply to this email.

A new appointment has been created. Please review.

Event Details:
    Reference Number: {request.data["ref_number"]}
    Customer: {request.data["company_name"]}
    Date Time: {date_time.strftime('%Y-%m-%d %H:%M:%S')}
</pre>''')

        else:  # created from the request page
            date_time = datetime.fromisoformat(
                request.data["date_time"].replace('Z', '+00:00'))
            date_time = date_time.astimezone(
                pytz.timezone('America/New_York'))
            send_email(  # to sales team
                'candor.scheduling@gmail.com',
                'New Pending Request',
                F'''
<pre>Please do not reply to this email.

A new request is now pending. Please review.

Event Details:
    Reference Number: {request.data["ref_number"]}
    Custome: {request.data["company_name"]}
    Date Time: {date_time.strftime('%Y-%m-%d %H:%M:%S')}
</pre>''')

            send_email(  # to customer
                'candor.scheduling@gmail.com',
                'Appointment Request Confirmation',
                F'''
<pre>Please do not reply to this email.
Email sales@candortransport.com for any issues.

Your appointment request has been received. Please allow 24 hours for approval.

Request Details:
    Reference Number: {request.data["ref_number"]}
    DateTime: {date_time.strftime('%Y-%m-%d %H:%M:%S')}

Thank you for choosing Candor Logistics.</pre>'''
            )

        return response


class WarehouseView(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    queryset = Warehouse.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class ScheduleView(viewsets.ModelViewSet):
    serializer_class = ScheduleSerializer
    queryset = Schedule.objects.all()


class UserView(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()


class GroupView(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    queryset = Group.objects.all()

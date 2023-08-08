from django.shortcuts import render
from rest_framework import viewsets, filters
from .serializers import *
from .models import *

from datetime import datetime


class RequestView(viewsets.ModelViewSet):
    serializer_class = RequestSerializer
    queryset = Request.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        isApproved = self.request.query_params.get('approved')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if isApproved:
            queryset = queryset.filter(approved=isApproved)
            if start_date and end_date:
                queryset = queryset.filter(
                    date_time__gte=start_date, date_time__lte=end_date)
        return queryset


class EmployeeView(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    queryset = Employee.objects.all()


class RoleView(viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    queryset = Role.objects.all()


class WarehouseView(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    queryset = Warehouse.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class ActionsLogView(viewsets.ModelViewSet):
    serializer_class = ActionsLogSerializer
    queryset = ActionsLog.objects.all()


class ScheduleView(viewsets.ModelViewSet):
    serializer_class = ScheduleSerializer
    queryset = Schedule.objects.all()

from django.shortcuts import render
from rest_framework import viewsets, filters
from .serializers import *
from .models import *


class RequestView(viewsets.ModelViewSet):
    serializer_class = RequestSerializer
    queryset = Request.objects.all()
    filter_backends = [filters.SearchFilter]
    search_fields = ['date_time', 'approved', 'company_name',
                     'warehouse', 'po_number', 'load_type', 'container_number']


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

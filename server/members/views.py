from django.shortcuts import render
from rest_framework import viewsets
from .serializers import *
from .models import *


class RequestView(viewsets.ModelViewSet):
    serializer_class = RequestSerializer
    queryset = Request.objects.all()


class EmployeeView(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    queryset = Employee.objects.all()


class RoleView(viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    queryset = Role.objects.all()


class WarehouseView(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer
    queryset = Warehouse.objects.all()


class ActionsLogView(viewsets.ModelViewSet):
    serializer_class = ActionsLogSerializer
    queryset = ActionsLog.objects.all()


class ScheduleView(viewsets.ModelViewSet):
    serializer_class = ScheduleSerializer
    queryset = Schedule.objects.all()

from django.shortcuts import render
from rest_framework import viewsets, filters, status
from .serializers import *
from .models import *
from django.contrib.auth.models import User, Group


from datetime import datetime

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, permissions

from rest_framework.parsers import JSONParser


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

    def put(self, request, pk, format=None):
        try:
            requestUpdate = self.get_object(pk)
        except Request.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        data = JSONParser().parse(request)

        serializer = RequestSerializer(requestUpdate, data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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

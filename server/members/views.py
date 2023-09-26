from django.shortcuts import render
from rest_framework import viewsets, filters, status
from .serializers import *
from .models import *
from django.contrib.auth.models import User, Group


from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status


class HomeView(APIView):
    permission_classes = (IsAuthenticated, )

    def get(self, request):

        content = {'message': 'Welcome to CT-Scheduling!'}
        return Response(content)


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


class LogoutView(APIView):
    permission_classes = (IsAuthenticated, )

    def post(self, request):
        try:
            refresh_token = request.data["refresh_token"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response(status=status.HTTP_400_BAD_REQUEST)


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

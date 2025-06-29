from django.urls import path
from . import views

urlpatterns = [
    path('api/user-groups/', views.UserGroupsView.as_view(), name='user-groups'),
]

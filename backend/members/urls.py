from django.urls import path
from . import views

urlpatterns = [
    path('api/user-groups/', views.UserGroupsView.as_view(), name='user-groups'),
    path('api/pending-requests-stats/', views.PendingRequestStatsView.as_view(), name='pending-requests-stats'),
]

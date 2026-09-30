from django.urls import path
from . import views, audit_views

urlpatterns = [
    path('api/user-groups/', views.UserGroupsView.as_view(), name='user-groups'),
    path('api/pending-requests-stats/', views.PendingRequestStatsView.as_view(), name='pending-requests-stats'),
    path('api/e2e-seed/', views.E2ESeedView.as_view(), name='e2e-seed'),
    path('api/audit/events/', audit_views.AuditEventsView.as_view(), name='audit-events'),
    path('api/audit/notifications/', audit_views.AuditNotificationsView.as_view(), name='audit-notifications'),
    path('api/audit/timeline/', audit_views.AuditTimelineView.as_view(), name='audit-timeline'),
    path('api/audit/actors/', audit_views.AuditActorsView.as_view(), name='audit-actors'),
]

from django.urls import path
from . import views

urlpatterns = [
    # path('members/', views.models, name='members'),
    path('home/', views.HomeView.as_view(), name='home'),
]

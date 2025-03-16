from django.urls import path, re_path
from . import views
from .views import serve_react_frontend

urlpatterns = [
    re_path(r"^(?!api/).*", serve_react_frontend),  # Serves React for all non-API routes
]

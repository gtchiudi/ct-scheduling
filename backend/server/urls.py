"""
URL configuration for server project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework import routers
from members import views
from rest_framework_simplejwt import views as jwt_views
from django.views.generic import TemplateView
from django.conf.urls.static import static
from django.conf import settings

router = routers.DefaultRouter()
router.register(r'request', views.RequestView, 'request')
router.register(r'warehouse', views.WarehouseView, 'warehouse')
router.register(r'schedule', views.ApprovalLogView, 'schedule')
router.register(r'user', views.UserView, 'user')
router.register(r'group', views.GroupView, 'group')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('token/',
         jwt_views.TokenObtainPairView.as_view(),
         name='token_obtain_pair'),
    path('token/refresh/',
         jwt_views.TokenRefreshView.as_view(),
         name='token_refresh'),
    path('', include('members.urls')),
    path('api-auth/', include('rest_framework.urls')),
    path('', TemplateView.as_view(template_name='index.html')),
    path('login', TemplateView.as_view(template_name='index.html')),
    path('Calendar', TemplateView.as_view(template_name='index.html')),
    path('logout', TemplateView.as_view(template_name='index.html')),
    path('RequestForm', TemplateView.as_view(template_name='index.html')),
    path('PendingRequests', TemplateView.as_view(template_name='index.html')),
]
# if settings.DEBUG:
#     urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
# else:
#     from whitenoise import WhiteNoise
#     application = WhiteNoise(application, root=settings.STATIC_ROOT)

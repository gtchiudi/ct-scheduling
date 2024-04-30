from django.contrib import admin
from .models import *


class requestListView(admin.ModelAdmin):
    list_display = ("approved", "company_name",
                    "email", "warehouse", "ref_number", "date_time")


admin.site.register(Request, requestListView)
admin.site.register(Warehouse)
admin.site.register(Schedule)

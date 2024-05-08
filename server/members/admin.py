from django.contrib import admin
from .models import *


class requestListView(admin.ModelAdmin):
    list_display = ("approved", "company_name",
                    "email", "warehouse", "ref_number", "date_time")


class ApprovalLogListView(admin.ModelAdmin):
    list_display = ('approver', 'request_ref_number',
                    'request_company_name', 'request_date_time')

    def request_ref_number(self, obj):
        return obj.request.ref_number
    request_ref_number.short_description = 'Request Ref Number'  # Sets column header

    def request_company_name(self, obj):
        return obj.request.company_name
    request_company_name.short_description = 'Request Company Name'  # Sets column header

    def request_date_time(self, obj):
        return obj.request.date_time
    request_date_time.short_description = 'Request Date Time'  # Sets column header


admin.site.register(Request, requestListView)
admin.site.register(Warehouse)
admin.site.register(ApprovalLog, ApprovalLogListView)

from django.contrib import admin
from .models import *


class requestListView(admin.ModelAdmin):
    list_display = ("approved", "company_name", "customer_name",
                    "email", "warehouse", "ref_number", "date_time", "active")
    list_display_links = ("company_name", "ref_number")
    search_fields = ("company_name", "email", "ref_number", "driver_phone_number")
    list_filter = ("approved", "active", "warehouse", "load_type", "delivery", "date_time")


class WarehouseListView(admin.ModelAdmin):
    list_display = ("name", "address", "phone_number", "timezone", "active")
    search_fields = ("name", "address")
    list_filter = ("active",)

class CustomerListView(admin.ModelAdmin):
    list_display = ('customer_name', 'email_address', 'send_email_updates')
    search_fields = ('customer_name', 'email_address')
    list_filter = ('active',)


class ApprovalLogListView(admin.ModelAdmin):
    list_display = ('approver', 'request_ref_number',
                    'request_company_name', 'request_date_time')
    list_display_links = ('request_ref_number',)
    search_fields = ('approver__username', 'request__ref_number', 'request__company_name')
    list_filter = ('approver',)

    def request_ref_number(self, obj):
        return obj.request.ref_number
    request_ref_number.short_description = 'Request Ref Number'

    def request_company_name(self, obj):
        return obj.request.company_name
    request_company_name.short_description = 'Request Company Name'

    def request_date_time(self, obj):
        return obj.request.date_time
    request_date_time.short_description = 'Request Date Time'


class SmsNumberLogListView(admin.ModelAdmin):
    list_display = ("sms_number", "consent", "active")
    search_fields = ("sms_number",)
    list_filter = ("consent", "active")


class ReadOnlyAdmin(admin.ModelAdmin):
    """Audit records are written by the app only; the admin can look, not touch."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class AppointmentEventAdmin(ReadOnlyAdmin):
    list_display = ('occurred_at', 'action', 'actor', 'appointment_ref', 'appointment_company')
    list_filter = ('action', 'occurred_at')
    search_fields = ('appointment__ref_number', 'appointment__company_name', 'actor__username')
    list_select_related = ('actor', 'appointment')
    raw_id_fields = ('appointment', 'actor')

    def appointment_ref(self, obj):
        return obj.appointment.ref_number
    appointment_ref.short_description = 'Ref number'

    def appointment_company(self, obj):
        return obj.appointment.company_name
    appointment_company.short_description = 'Company'


class NotificationLogAdmin(ReadOnlyAdmin):
    list_display = ('sent_at', 'channel', 'kind', 'status', 'recipient', 'subject')
    list_filter = ('channel', 'kind', 'status', 'sent_at')
    search_fields = ('recipient', 'subject', 'appointment__ref_number', 'appointment__company_name')
    raw_id_fields = ('appointment',)


admin.site.register(Request, requestListView)
admin.site.register(Warehouse, WarehouseListView)
admin.site.register(ApprovalLog, ApprovalLogListView)
admin.site.register(SmsNumberLog, SmsNumberLogListView)
admin.site.register(Customer, CustomerListView)
admin.site.register(AppointmentEvent, AppointmentEventAdmin)
admin.site.register(NotificationLog, NotificationLogAdmin)

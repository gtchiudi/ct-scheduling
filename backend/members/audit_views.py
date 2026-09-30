"""Read-only audit API under /api/audit/.

  GET /api/audit/events/         appointment events (paged, filterable, CSV)
  GET /api/audit/notifications/  email/SMS log (paged, filterable, CSV)
  GET /api/audit/timeline/       events + notifications for one appointment
  GET /api/audit/actors/         users that appear as an event actor

Only audit viewers (superusers and members of Admin or Dispatch) may call
these; Dock users get 403 and anonymous callers 401.
"""

import csv
import json
import re
import uuid
from datetime import datetime, time, timedelta

import pytz
from django.contrib.auth.models import User
from django.db.models import F, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.utils.urls import remove_query_param, replace_query_param
from rest_framework.views import APIView

from .models import AppointmentEvent, NotificationLog

AUDIT_GROUPS = ('Admin', 'Dispatch')
AUDIT_TZ = pytz.timezone('America/New_York')
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500


class IsAuditViewer(permissions.BasePermission):
    message = 'Audit history is limited to Admin and Dispatch users.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return user.is_superuser or user.groups.filter(name__in=AUDIT_GROUPS).exists()


class BadParam(Exception):
    pass


def display_name(user):
    if user is None:
        return None
    return user.get_full_name() or user.username


def iso(dt):
    if dt is None:
        return None
    return timezone.localtime(dt).isoformat()


def _param(request, name):
    value = request.query_params.get(name, '')
    return value.strip()


def _csv_list(request, name):
    return [v.strip() for v in _param(request, name).split(',') if v.strip()]


def _uuid(request, name):
    value = _param(request, name)
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        raise BadParam(f'{name} must be a UUID.')


def _date(request, name):
    value = _param(request, name)
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        raise BadParam(f'{name} must be a date in YYYY-MM-DD format.')


def _positive_int(request, name, default):
    value = _param(request, name)
    if not value:
        return default
    try:
        number = int(value)
    except ValueError:
        raise BadParam(f'{name} must be a positive integer.')
    if number < 1:
        raise BadParam(f'{name} must be a positive integer.')
    return number


# Appointment fields the `search` box matches on both tabs.
APPOINTMENT_SEARCH_FIELDS = (
    'appointment__ref_number', 'appointment__company_name', 'appointment__customer_name',
)
MAX_SEARCH_TERMS = 10


def apply_search(request, queryset, fields):
    """`search`: every whitespace-separated word must appear (case-insensitive)
    in at least one of `fields`, like DRF's SearchFilter."""
    terms = _param(request, 'search').split()[:MAX_SEARCH_TERMS]
    for term in terms:
        match = Q()
        for field in fields:
            match |= Q(**{f'{field}__icontains': term})
        queryset = queryset.filter(match)
    return queryset


def apply_common_filters(request, queryset, time_field):
    """start/end (inclusive local dates), warehouse and appointment filters."""
    start = _date(request, 'start')
    end = _date(request, 'end')
    if start:
        queryset = queryset.filter(**{
            f'{time_field}__gte': AUDIT_TZ.localize(datetime.combine(start, time.min))})
    if end:
        queryset = queryset.filter(**{
            f'{time_field}__lt': AUDIT_TZ.localize(datetime.combine(end + timedelta(days=1), time.min))})
    warehouse = _uuid(request, 'warehouse')
    if warehouse:
        queryset = queryset.filter(appointment__warehouse_id=warehouse)
    appointment = _uuid(request, 'appointment')
    if appointment:
        queryset = queryset.filter(appointment_id=appointment)
    return queryset


# ---------------------------------------------------------------------------
# Row serialisation
# ---------------------------------------------------------------------------

def _appointment_fields(appointment):
    if appointment is None:
        return {'appointment_ref': None, 'appointment_company': None,
                'warehouse': None, 'warehouse_name': None}
    warehouse = appointment.warehouse
    return {
        'appointment_ref': appointment.ref_number,
        'appointment_company': appointment.company_name,
        'warehouse': str(appointment.warehouse_id) if appointment.warehouse_id else None,
        'warehouse_name': warehouse.name if warehouse else None,
    }


def event_actor_name(event):
    if event.actor_id is None:
        return 'Request form' if event.action == 'created' else 'Unknown'
    return display_name(event.actor)


def serialize_event(event):
    info = _appointment_fields(event.appointment)
    return {
        'id': str(event.id),
        'appointment': str(event.appointment_id),
        'appointment_ref': info['appointment_ref'],
        'appointment_company': info['appointment_company'],
        'warehouse': info['warehouse'],
        'warehouse_name': info['warehouse_name'],
        'actor': event.actor_id,
        'actor_name': event_actor_name(event),
        'action': event.action,
        'changes': event.changes or {},
        'occurred_at': iso(event.occurred_at),
    }


def serialize_notification(log):
    info = _appointment_fields(log.appointment)
    return {
        'id': str(log.id),
        'appointment': str(log.appointment_id) if log.appointment_id else None,
        'appointment_ref': info['appointment_ref'],
        'appointment_company': info['appointment_company'],
        'warehouse_name': info['warehouse_name'],
        'channel': log.channel,
        'recipient': log.recipient,
        'kind': log.kind,
        'subject': log.subject,
        'status': log.status,
        'error': log.error,
        'sent_at': iso(log.sent_at),
    }


# ---------------------------------------------------------------------------
# Paging / CSV
# ---------------------------------------------------------------------------

def paginate(request, queryset, serialize):
    page = _positive_int(request, 'page', 1)
    page_size = min(_positive_int(request, 'page_size', DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
    count = queryset.count()
    offset = (page - 1) * page_size
    rows = [serialize(obj) for obj in queryset[offset:offset + page_size]]
    url = request.build_absolute_uri()
    next_url = replace_query_param(url, 'page', page + 1) if offset + page_size < count else None
    if page <= 1:
        previous_url = None
    elif page == 2:
        previous_url = remove_query_param(url, 'page')
    else:
        previous_url = replace_query_param(url, 'page', page - 1)
    return Response({'count': count, 'next': next_url, 'previous': previous_url, 'results': rows})


_PLAIN_NUMBER = re.compile(r'^[+-]?[\d\s().-]*$')


def csv_safe(value):
    """Neutralise spreadsheet formula injection in user-supplied text.

    Cells starting with = @ tab or CR are always prefixed with an apostrophe;
    + and - only when the rest is not a plain phone/number, so recipients like
    +15551234567 export unchanged.
    """
    if value is None:
        return ''
    if not isinstance(value, str):
        return value
    if value[:1] in ('=', '@', '\t', '\r'):
        return "'" + value
    if value[:1] in ('+', '-') and not _PLAIN_NUMBER.match(value):
        return "'" + value
    return value


def csv_response(filename_prefix, columns, rows):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    stamp = timezone.localtime().strftime('%Y%m%d-%H%M%S')
    response['Content-Disposition'] = f'attachment; filename="{filename_prefix}-{stamp}.csv"'
    writer = csv.writer(response)
    writer.writerow(columns)
    for row in rows:
        writer.writerow([csv_safe(row.get(col)) for col in columns])
    return response


class AuditListView(APIView):
    permission_classes = [IsAuditViewer]
    csv_prefix = ''
    csv_columns = ()

    def get_queryset(self, request):
        raise NotImplementedError

    def serialize(self, obj):
        raise NotImplementedError

    def csv_row(self, obj):
        return self.serialize(obj)

    def get(self, request):
        try:
            queryset = self.get_queryset(request)
            if _param(request, 'export').lower() == 'csv':
                return csv_response(self.csv_prefix, self.csv_columns,
                                    (self.csv_row(obj) for obj in queryset.iterator(chunk_size=500)))
            return paginate(request, queryset, self.serialize)
        except BadParam as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def _event_queryset():
    return (AppointmentEvent.objects
            .select_related('actor', 'appointment', 'appointment__warehouse')
            .order_by(F('occurred_at').desc(nulls_last=True), '-id'))


def _notification_queryset():
    return (NotificationLog.objects
            .select_related('appointment', 'appointment__warehouse')
            .order_by('-sent_at', '-id'))


class AuditEventsView(AuditListView):
    csv_prefix = 'appointment-activity'
    csv_columns = ('occurred_at', 'action', 'actor_name', 'appointment_ref', 'appointment_company',
                   'warehouse_name', 'changes', 'appointment')

    def get_queryset(self, request):
        queryset = apply_common_filters(request, _event_queryset(), 'occurred_at')
        actor = _param(request, 'actor')
        if actor:
            if actor.lower() == 'none':
                queryset = queryset.filter(actor__isnull=True)
            else:
                try:
                    queryset = queryset.filter(actor_id=int(actor))
                except ValueError:
                    raise BadParam('actor must be a user id or "none".')
        actions = _csv_list(request, 'action')
        if actions:
            queryset = queryset.filter(action__in=actions)
        return apply_search(request, queryset, APPOINTMENT_SEARCH_FIELDS)

    def serialize(self, obj):
        return serialize_event(obj)

    def csv_row(self, obj):
        row = serialize_event(obj)
        row['changes'] = json.dumps(row['changes'], ensure_ascii=False) if row['changes'] else ''
        return row


class AuditNotificationsView(AuditListView):
    csv_prefix = 'notifications'
    csv_columns = ('sent_at', 'channel', 'kind', 'status', 'recipient', 'subject', 'error',
                   'appointment_ref', 'appointment_company', 'warehouse_name', 'appointment')

    def get_queryset(self, request):
        queryset = apply_common_filters(request, _notification_queryset(), 'sent_at')
        channel = _param(request, 'channel')
        if channel:
            queryset = queryset.filter(channel=channel)
        kinds = _csv_list(request, 'kind')
        if kinds:
            queryset = queryset.filter(kind__in=kinds)
        status_value = _param(request, 'status')
        if status_value:
            queryset = queryset.filter(status=status_value)
        recipient = _param(request, 'recipient')
        if recipient:
            queryset = queryset.filter(recipient__icontains=recipient)
        return apply_search(request, queryset,
                            APPOINTMENT_SEARCH_FIELDS + ('recipient', 'subject'))

    def serialize(self, obj):
        return serialize_notification(obj)


class AuditTimelineView(APIView):
    permission_classes = [IsAuditViewer]

    def get(self, request):
        try:
            appointment = _uuid(request, 'appointment')
        except BadParam as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if appointment is None:
            return Response({'detail': 'appointment is required.'}, status=status.HTTP_400_BAD_REQUEST)

        items = []
        for event in AppointmentEvent.objects.filter(appointment_id=appointment).select_related('actor'):
            items.append((event.occurred_at, {
                'type': 'event',
                'at': iso(event.occurred_at),
                'id': str(event.id),
                'action': event.action,
                'actor_name': event_actor_name(event),
                'changes': event.changes or {},
            }))
        for log in NotificationLog.objects.filter(appointment_id=appointment):
            items.append((log.sent_at, {
                'type': 'notification',
                'at': iso(log.sent_at),
                'id': str(log.id),
                'channel': log.channel,
                'kind': log.kind,
                'recipient': log.recipient,
                'status': log.status,
                'subject': log.subject,
                'error': log.error,
            }))
        # Newest first; undated imported approvals last.
        dated = sorted((i for i in items if i[0] is not None), key=lambda i: i[0], reverse=True)
        undated = [i for i in items if i[0] is None]
        return Response([item for _, item in dated + undated])


class AuditActorsView(APIView):
    permission_classes = [IsAuditViewer]

    def get(self, request):
        users = User.objects.filter(appointment_events__isnull=False).distinct()
        actors = [{'id': u.id, 'name': display_name(u)} for u in users]
        actors.sort(key=lambda a: (a['name'].lower(), a['id']))
        return Response(actors)

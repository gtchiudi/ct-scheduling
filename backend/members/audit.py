"""Appointment audit capture.

RequestView calls into this module to record who did what to an appointment.
Capture is best-effort by design: every public function here swallows and logs
its own errors inside a savepoint, so a problem writing the audit trail can
never fail (or roll back) the action being audited.

Updates are diffed from a snapshot of the model's field values taken before the
save against a fresh read after it. This is deliberately independent of the
string-normalised ``altered_fields`` heuristic RequestView uses to decide which
emails to send.
"""

import logging
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from .models import AppointmentEvent, Customer, Request, Warehouse

logger = logging.getLogger(__name__)

# Timestamps that become their own lifecycle event when first set.
LIFECYCLE_TIMESTAMPS = (
    ('check_in_time', 'checked_in'),
    ('docked_time', 'docked'),
    ('completed_time', 'completed'),
)

# Never reported as an `edited` change: identity, flags turned into their own
# events, audit bookkeeping and the lifecycle timestamps consumed above.
EXCLUDED_FROM_EDITS = {
    'id', 'active', 'approved', 'created_by', 'created_at', 'updated_at',
    'cancelled_time', 'check_in_time', 'docked_time', 'completed_time',
}


def actor_or_none(request):
    user = getattr(request, 'user', None)
    if user is not None and user.is_authenticated:
        return user
    return None


def snapshot(appointment):
    """Raw field values of an appointment, keyed by field name (FKs as ids)."""
    return {
        field.name: getattr(appointment, field.attname)
        for field in Request._meta.concrete_fields
    }


def snapshot_from_db(pk):
    return snapshot(Request.objects.get(pk=pk))


def _same(field_name, old, new):
    if old == new:
        return True
    # The appointment form sends whole seconds, while rows created through the
    # API or seed data can carry microseconds; that is not an edit.
    if isinstance(old, datetime) and isinstance(new, datetime):
        return old.replace(microsecond=0) == new.replace(microsecond=0)
    # Blank text inputs come back from the form as "" for columns that were
    # NULL; that is not a change anyone made.
    if old in (None, '') and new in (None, ''):
        return True
    return False


def _display(field_name, value):
    """JSON-safe, human-meaningful representation of a field value."""
    if value is None:
        return None
    if field_name == 'warehouse':
        name = Warehouse.objects.filter(pk=value).values_list('name', flat=True).first()
        return name if name is not None else str(value)
    if field_name == 'customer':
        name = Customer.objects.filter(pk=value).values_list('customer_name', flat=True).first()
        return name if name is not None else str(value)
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def diff_to_events(before, after):
    """Turn a before/after snapshot pair into [(action, changes), ...]."""
    events = []
    if not before['approved'] and after['approved']:
        events.append(('approved', {}))
    if before['active'] and not after['active'] and after['cancelled_time'] is None:
        # Only a pending request can be declined; an approved one set inactive
        # was taken off the calendar (mirrors RequestView.update's email logic).
        events.append(('removed' if before['approved'] else 'declined', {}))
    if before['cancelled_time'] is None and after['cancelled_time'] is not None:
        events.append(('cancelled', {}))
    for field_name, action in LIFECYCLE_TIMESTAMPS:
        if before[field_name] is None and after[field_name] is not None:
            events.append((action, {}))

    changes = {}
    for field_name, old in before.items():
        if field_name in EXCLUDED_FROM_EDITS:
            continue
        new = after.get(field_name)
        if not _same(field_name, old, new):
            changes[field_name] = [_display(field_name, old), _display(field_name, new)]
    if changes:
        events.append(('edited', changes))
    return events


def _write(appointment_id, actor, events):
    with transaction.atomic():
        for action, changes in events:
            AppointmentEvent.objects.create(
                appointment_id=appointment_id,
                actor=actor,
                action=action,
                changes=changes,
            )


def record_created(appointment, actor):
    try:
        _write(appointment.pk, actor, [('created', {})])
    except Exception:
        logger.exception('Audit: failed to record creation of appointment %s', appointment.pk)


def record_update(pk, before, actor):
    """Diff `before` against the current DB row and record the result."""
    try:
        if before is None:
            return
        after = snapshot_from_db(pk)
        events = diff_to_events(before, after)
        if events:
            _write(pk, actor, events)
    except Exception:
        logger.exception('Audit: failed to record update of appointment %s', pk)


def record_action(pk, actor, action):
    """Record a single action with no field changes."""
    try:
        _write(pk, actor, [(action, {})])
    except Exception:
        logger.exception('Audit: failed to record %s of appointment %s', action, pk)


def record_cancelled(appointment, actor):
    record_action(appointment.pk, actor, 'cancelled')


def safe_snapshot(appointment):
    try:
        return snapshot(appointment)
    except Exception:
        logger.exception('Audit: failed to snapshot appointment %s', appointment.pk)
        return None

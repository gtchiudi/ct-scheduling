"""Fold existing ApprovalLog rows into the audit trail as `approved` events.

ApprovalLog never recorded when an approval happened, so the imported events
have occurred_at = NULL ("date unknown"). The ApprovalLog table itself is left
untouched.
"""

from django.db import migrations

BATCH_SIZE = 500


def import_approval_logs(apps, schema_editor):
    ApprovalLog = apps.get_model('members', 'ApprovalLog')
    AppointmentEvent = apps.get_model('members', 'AppointmentEvent')
    batch = []
    for log in ApprovalLog.objects.all().only('approver_id', 'request_id').iterator():
        batch.append(AppointmentEvent(
            appointment_id=log.request_id,
            actor_id=log.approver_id,
            action='approved',
            changes={},
            occurred_at=None,
        ))
        if len(batch) >= BATCH_SIZE:
            AppointmentEvent.objects.bulk_create(batch)
            batch = []
    if batch:
        AppointmentEvent.objects.bulk_create(batch)


def remove_imported_events(apps, schema_editor):
    AppointmentEvent = apps.get_model('members', 'AppointmentEvent')
    AppointmentEvent.objects.filter(action='approved', occurred_at__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0021_audit_fields_appointmentevent'),
    ]

    operations = [
        migrations.RunPython(import_approval_logs, remove_imported_events),
    ]

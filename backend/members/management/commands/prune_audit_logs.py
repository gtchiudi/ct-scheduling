"""Delete audit rows older than the configured retention period.

    python manage.py prune_audit_logs [--days N] [--dry-run]

Events older than AUDIT_RETENTION_DAYS and notifications older than
NOTIFICATION_RETENTION_DAYS are deleted. --days overrides both. With no
retention configured and no --days, nothing is deleted. Approvals imported
from ApprovalLog (occurred_at NULL, date unknown) are never deleted.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from members.models import AppointmentEvent, NotificationLog

BATCH_SIZE = 5000

logger = logging.getLogger(__name__)


def _delete_in_batches(queryset):
    deleted = 0
    while True:
        pks = list(queryset.values_list('pk', flat=True)[:BATCH_SIZE])
        if not pks:
            return deleted
        count, _ = queryset.model.objects.filter(pk__in=pks).delete()
        deleted += count


class Command(BaseCommand):
    help = 'Delete appointment events and notification logs older than the retention period.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=None,
                            help='Retention in days for both events and notifications '
                                 '(overrides AUDIT_RETENTION_DAYS / NOTIFICATION_RETENTION_DAYS).')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would be deleted without deleting anything.')

    def _setting(self, name):
        """A retention setting, or None when unset or not a positive integer."""
        value = getattr(settings, name, None)
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            message = f'{name}={value!r} is not a positive number of days; ignoring it (keeping all).'
            logger.warning(message)
            self.stderr.write(f'Warning: {message}')
            return None
        return value

    def handle(self, *args, days=None, dry_run=False, **options):
        if days is not None and days < 1:
            raise CommandError('--days must be at least 1.')

        event_days = days if days is not None else self._setting('AUDIT_RETENTION_DAYS')
        notification_days = days if days is not None else self._setting('NOTIFICATION_RETENTION_DAYS')
        now = timezone.now()
        verb = 'Would delete' if dry_run else 'Deleted'

        targets = (
            ('appointment events', AppointmentEvent, 'occurred_at', event_days),
            ('notification logs', NotificationLog, 'sent_at', notification_days),
        )
        for label, model, field, retention in targets:
            if retention is None:
                self.stdout.write(f'No retention configured for {label}; keeping all.')
                continue
            cutoff = now - timedelta(days=retention)
            # __lt never matches NULL, so undated imported approvals are kept.
            queryset = model.objects.filter(**{f'{field}__lt': cutoff})
            count = queryset.count() if dry_run else _delete_in_batches(queryset)
            self.stdout.write(f'{verb} {count} {label} older than {retention} days '
                              f'(before {timezone.localtime(cutoff):%Y-%m-%d %H:%M %Z}).')

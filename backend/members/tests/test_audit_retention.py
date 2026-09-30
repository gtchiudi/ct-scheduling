"""
Retention tests — prune_audit_logs management command, retention settings and
the read-only admin registrations.
"""

import importlib
from datetime import timedelta
from io import StringIO

import pytest
from django.contrib import admin
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import RequestFactory
from django.utils import timezone

from members.models import AppointmentEvent, NotificationLog, Request


def _run(*args):
    out = StringIO()
    call_command("prune_audit_logs", *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def aged(approved_request):
    now = timezone.now()
    E = AppointmentEvent.objects.create
    N = NotificationLog.objects.create
    return {
        "old_event": E(appointment=approved_request, action="edited", occurred_at=now - timedelta(days=100)),
        "new_event": E(appointment=approved_request, action="edited", occurred_at=now - timedelta(days=10)),
        "undated": E(appointment=approved_request, action="approved", occurred_at=None),
        "old_note": N(appointment=approved_request, channel="email", recipient="a@b.com", kind="approval",
                      status="sent", sent_at=now - timedelta(days=100)),
        "new_note": N(appointment=approved_request, channel="email", recipient="a@b.com", kind="approval",
                      status="sent", sent_at=now - timedelta(days=10)),
    }


@pytest.mark.django_db
def test_noop_when_retention_unset(aged, settings):
    settings.AUDIT_RETENTION_DAYS = None
    settings.NOTIFICATION_RETENTION_DAYS = None
    out = _run()
    assert "keeping all" in out
    assert AppointmentEvent.objects.count() == 3
    assert NotificationLog.objects.count() == 2


@pytest.mark.django_db
def test_prunes_with_settings(aged, settings):
    settings.AUDIT_RETENTION_DAYS = 30
    settings.NOTIFICATION_RETENTION_DAYS = 30
    out = _run()
    assert set(AppointmentEvent.objects.values_list("id", flat=True)) == {aged["new_event"].id, aged["undated"].id}
    assert list(NotificationLog.objects.values_list("id", flat=True)) == [aged["new_note"].id]
    assert "Deleted 1 appointment events" in out
    assert "Deleted 1 notification logs" in out


@pytest.mark.django_db
def test_never_deletes_undated_imported_approvals(aged, settings):
    _run("--days", "1")
    assert AppointmentEvent.objects.filter(id=aged["undated"].id).exists()
    assert not AppointmentEvent.objects.filter(occurred_at__isnull=False).exists()


@pytest.mark.django_db
def test_days_option_overrides_settings(aged, settings):
    settings.AUDIT_RETENTION_DAYS = None
    settings.NOTIFICATION_RETENTION_DAYS = None
    _run("--days", "50")
    assert AppointmentEvent.objects.count() == 2
    assert NotificationLog.objects.count() == 1


@pytest.mark.django_db
def test_separate_notification_retention(aged, settings):
    settings.AUDIT_RETENTION_DAYS = None
    settings.NOTIFICATION_RETENTION_DAYS = 5
    _run()
    assert AppointmentEvent.objects.count() == 3
    assert NotificationLog.objects.count() == 0


@pytest.mark.django_db
def test_dry_run_deletes_nothing(aged, settings):
    out = _run("--days", "30", "--dry-run")
    assert "Would delete 1 appointment events" in out
    assert "Would delete 1 notification logs" in out
    assert AppointmentEvent.objects.count() == 3
    assert NotificationLog.objects.count() == 2


@pytest.mark.django_db
def test_batched_delete(approved_request, monkeypatch):
    cmd = importlib.import_module("members.management.commands.prune_audit_logs")
    monkeypatch.setattr(cmd, "BATCH_SIZE", 2)
    old = timezone.now() - timedelta(days=100)
    AppointmentEvent.objects.bulk_create(
        [AppointmentEvent(appointment=approved_request, action="edited", occurred_at=old) for _ in range(5)])
    out = _run("--days", "30")
    assert "Deleted 5 appointment events" in out
    assert AppointmentEvent.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("value", [0, -5, "30"])
def test_invalid_retention_settings_are_ignored_with_warning(aged, settings, value, caplog):
    settings.AUDIT_RETENTION_DAYS = value
    settings.NOTIFICATION_RETENTION_DAYS = value
    err = StringIO()
    call_command("prune_audit_logs", stdout=StringIO(), stderr=err)
    assert "not a positive number of days" in err.getvalue()
    assert "AUDIT_RETENTION_DAYS" in caplog.text
    assert AppointmentEvent.objects.count() == 3
    assert NotificationLog.objects.count() == 2


@pytest.mark.django_db
def test_rejects_non_positive_days():
    with pytest.raises(CommandError):
        _run("--days", "0")


# ---------------------------------------------------------------------------
# Settings parsing
# ---------------------------------------------------------------------------

def _reload_settings(monkeypatch, **env):
    for key in ("AUDIT_RETENTION_DAYS", "NOTIFICATION_RETENTION_DAYS"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    import server.settings as s
    return importlib.reload(s)


def test_settings_default_to_none(monkeypatch):
    s = _reload_settings(monkeypatch)
    assert s.AUDIT_RETENTION_DAYS is None
    assert s.NOTIFICATION_RETENTION_DAYS is None


def test_notification_retention_defaults_to_audit(monkeypatch):
    s = _reload_settings(monkeypatch, AUDIT_RETENTION_DAYS="400")
    assert s.AUDIT_RETENTION_DAYS == 400
    assert s.NOTIFICATION_RETENTION_DAYS == 400


@pytest.mark.parametrize("raw", ["0", "-1", "abc", "1.5", " "])
def test_invalid_env_retention_is_unset_and_does_not_crash(monkeypatch, raw):
    s = _reload_settings(monkeypatch, AUDIT_RETENTION_DAYS=raw, NOTIFICATION_RETENTION_DAYS=raw)
    assert s.AUDIT_RETENTION_DAYS is None
    assert s.NOTIFICATION_RETENTION_DAYS is None
    _reload_settings(monkeypatch)


def test_invalid_notification_env_falls_back_to_audit(monkeypatch):
    s = _reload_settings(monkeypatch, AUDIT_RETENTION_DAYS="200", NOTIFICATION_RETENTION_DAYS="-3")
    assert s.NOTIFICATION_RETENTION_DAYS == 200
    _reload_settings(monkeypatch)


def test_notification_retention_own_value(monkeypatch):
    s = _reload_settings(monkeypatch, AUDIT_RETENTION_DAYS="400", NOTIFICATION_RETENTION_DAYS="90")
    assert s.NOTIFICATION_RETENTION_DAYS == 90
    _reload_settings(monkeypatch)  # restore module state for other tests


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.parametrize("model", [AppointmentEvent, NotificationLog])
def test_admin_registered_read_only(model, django_user_model):
    model_admin = admin.site._registry[model]
    request = RequestFactory().get("/admin/")
    request.user = django_user_model.objects.create_superuser("su", "su@example.com", "pw")
    assert model_admin.has_add_permission(request) is False
    assert model_admin.has_change_permission(request) is False
    assert model_admin.has_view_permission(request) is True
    # Delete permission stays on (so cascades from Request/Warehouse work),
    # but there is no way to delete an audit row directly.
    assert "delete_selected" not in model_admin.get_actions(request)


@pytest.mark.django_db
def test_admin_blocks_direct_delete_but_allows_cascade(client, django_user_model, aged, approved_request, settings):
    settings.STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
    client.force_login(django_user_model.objects.create_superuser("su", "su@example.com", "pw"))
    event = aged["old_event"]
    assert client.get(f"/admin/members/appointmentevent/{event.pk}/delete/").status_code == 403
    assert client.post(f"/admin/members/appointmentevent/{event.pk}/delete/", {"post": "yes"}).status_code == 403
    page = client.get(f"/admin/members/appointmentevent/{event.pk}/change/")
    assert page.status_code == 200
    assert b"deletelink" not in page.content
    assert AppointmentEvent.objects.filter(pk=event.pk).exists()

    # Request.delete() is a soft delete, but the changelist bulk action deletes
    # the queryset for real and must cascade through the audit rows.
    response = client.post("/admin/members/request/", {
        "action": "delete_selected", "_selected_action": [str(approved_request.pk)], "post": "yes"})
    assert response.status_code == 302
    assert not Request.objects.filter(pk=approved_request.pk).exists()
    assert not AppointmentEvent.objects.filter(appointment_id=approved_request.pk).exists()
    assert NotificationLog.objects.filter(pk=aged["old_note"].pk, appointment__isnull=True).exists()


@pytest.mark.django_db
def test_admin_changelists_render(client, django_user_model, aged, settings):
    # The manifest storage needs collectstatic output that tests don't have.
    settings.STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
    user = django_user_model.objects.create_superuser("su", "su@example.com", "pw")
    client.force_login(user)
    assert client.get("/admin/members/appointmentevent/").status_code == 200
    assert client.get("/admin/members/notificationlog/").status_code == 200

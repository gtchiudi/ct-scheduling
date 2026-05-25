"""
Utility view tests — UserGroupsView and PendingRequestStatsView.

Covers:
  - Correct group names returned per user
  - Multi-group users
  - Pending request count accuracy
  - Urgent request detection (date_time <= now)
"""

import uuid
import pytest
from datetime import timedelta
from django.contrib.auth.models import User, Group
from django.utils import timezone

from members.models import Request
from members.tests.conftest import _get_or_create_group, _make_authed_client


# ===========================================================================
# UserGroupsView
# ===========================================================================

@pytest.mark.django_db
def test_user_groups_dispatch(dispatch_client):
    response = dispatch_client.get("/api/user-groups/")
    assert response.status_code == 200
    assert response.data["groups"] == ["Dispatch"]


@pytest.mark.django_db
def test_user_groups_dock(dock_client):
    response = dock_client.get("/api/user-groups/")
    assert response.status_code == 200
    assert response.data["groups"] == ["Dock"]


@pytest.mark.django_db
def test_user_groups_multi_group_user(db):
    """A user in both Admin and Dispatch should have both groups returned."""
    user = User.objects.create_user(username="multigroup", password="pass")
    user.groups.add(_get_or_create_group("Admin"))
    user.groups.add(_get_or_create_group("Dispatch"))
    client = _make_authed_client(user)
    response = client.get("/api/user-groups/")
    assert response.status_code == 200
    assert set(response.data["groups"]) == {"Admin", "Dispatch"}


# ===========================================================================
# PendingRequestStatsView
# ===========================================================================

@pytest.mark.django_db
def test_pending_stats_count(dispatch_client, warehouse, db):
    """pending_count reflects unapproved active requests only."""
    Request.objects.create(
        id=uuid.uuid4(), company_name="Pending 1", warehouse=warehouse,
        ref_number="P1", load_type="Full", delivery=True, active=True, approved=False,
        date_time=timezone.now() + timedelta(days=1),
    )
    Request.objects.create(
        id=uuid.uuid4(), company_name="Pending 2", warehouse=warehouse,
        ref_number="P2", load_type="Full", delivery=True, active=True, approved=False,
        date_time=timezone.now() + timedelta(days=2),
    )
    # This one is approved — should NOT count
    Request.objects.create(
        id=uuid.uuid4(), company_name="Approved", warehouse=warehouse,
        ref_number="APP", load_type="Full", delivery=True, active=True, approved=True,
        date_time=timezone.now() + timedelta(days=3),
    )
    # This one is inactive — should NOT count
    Request.objects.create(
        id=uuid.uuid4(), company_name="Inactive", warehouse=warehouse,
        ref_number="INA", load_type="Full", delivery=True, active=False, approved=False,
        date_time=timezone.now() + timedelta(days=4),
    )
    response = dispatch_client.get("/api/pending-requests-stats/")
    assert response.status_code == 200
    assert response.data["pending_count"] == 2


@pytest.mark.django_db
def test_pending_stats_urgent_when_past_due(dispatch_client, warehouse, db):
    """has_urgent_requests=True when a pending request's date_time is in the past."""
    Request.objects.create(
        id=uuid.uuid4(), company_name="Overdue", warehouse=warehouse,
        ref_number="OVR", load_type="Full", delivery=True, active=True, approved=False,
        date_time=timezone.now() - timedelta(hours=2),
    )
    response = dispatch_client.get("/api/pending-requests-stats/")
    assert response.status_code == 200
    assert response.data["has_urgent_requests"] is True


@pytest.mark.django_db
def test_pending_stats_not_urgent_when_all_future(dispatch_client, warehouse, db):
    """has_urgent_requests=False when all pending requests are in the future."""
    Request.objects.create(
        id=uuid.uuid4(), company_name="Future", warehouse=warehouse,
        ref_number="FUT", load_type="Full", delivery=True, active=True, approved=False,
        date_time=timezone.now() + timedelta(days=5),
    )
    response = dispatch_client.get("/api/pending-requests-stats/")
    assert response.status_code == 200
    assert response.data["has_urgent_requests"] is False


@pytest.mark.django_db
def test_pending_stats_zero(dispatch_client):
    """No pending requests → pending_count=0, has_urgent_requests=False."""
    response = dispatch_client.get("/api/pending-requests-stats/")
    assert response.status_code == 200
    assert response.data["pending_count"] == 0
    assert response.data["has_urgent_requests"] is False

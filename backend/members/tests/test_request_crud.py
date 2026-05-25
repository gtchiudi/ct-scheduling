"""
Request CRUD tests — standard list/create/read/delete operations.

Covers:
  - Creating approved and unapproved requests and verifying email notifications
  - Filtering by approved status, date range, and active flag
  - Nested customer object in detail responses
  - Soft-delete behavior (active=False, not hard-delete)
"""

import uuid
import pytest
from datetime import timedelta
from django.utils import timezone

from members.models import Request
from members.tests.conftest import build_request_payload


def _dt(days_offset):
    return (timezone.now() + timedelta(days=days_offset)).isoformat().replace("+00:00", "Z")


@pytest.mark.django_db
def test_create_unapproved_sends_two_emails(api_client, warehouse, mock_email):
    """Anonymous POST with approved=False triggers two emails:
    one to the Candor team, one to the requester."""
    payload = {
        "approved": False,
        "company_name": "New Request Co",
        "email": "requester@example.com",
        "warehouse": str(warehouse.id),
        "ref_number": "PO-NEW",
        "load_type": "Full",
        "date_time": _dt(5),
        "delivery": True,
    }
    response = api_client.post("/api/request/", payload, format="json")
    assert response.status_code == 201
    assert mock_email.call_count == 2


@pytest.mark.django_db
def test_create_approved_sends_one_team_email(dispatch_client, warehouse, customer, mock_email):
    """Dispatch POST with approved=True triggers one email to the team."""
    payload = {
        "approved": True,
        "company_name": "Calendar Co",
        "email": "calendar@example.com",
        "warehouse": str(warehouse.id),
        "ref_number": "PO-CAL",
        "load_type": "LTL",
        "date_time": _dt(3),
        "delivery": False,
        "customer_id": str(customer.id),
    }
    response = dispatch_client.post("/api/request/", payload, format="json")
    assert response.status_code == 201
    assert mock_email.call_count == 1


@pytest.mark.django_db
def test_create_approved_with_customer_updates_sends_two_emails(
    dispatch_client, warehouse, customer_with_updates, mock_email
):
    """When send_email_updates=True and the customer has an email,
    a second email goes to the customer."""
    payload = {
        "approved": True,
        "company_name": "Notify Co",
        "email": "contact@example.com",
        "warehouse": str(warehouse.id),
        "ref_number": "PO-NOTIFY",
        "load_type": "Full",
        "date_time": _dt(4),
        "delivery": True,
        "customer_id": str(customer_with_updates.id),
        "send_email_updates": True,
    }
    response = dispatch_client.post("/api/request/", payload, format="json")
    assert response.status_code == 201
    assert mock_email.call_count == 2


@pytest.mark.django_db
def test_list_excludes_inactive(dispatch_client, warehouse, customer):
    """Inactive requests (active=False) are excluded from the list."""
    Request.objects.create(
        id=uuid.uuid4(), company_name="Active 1", warehouse=warehouse,
        ref_number="A1", load_type="Full", date_time=timezone.now() + timedelta(days=1),
        delivery=True, active=True, approved=False,
    )
    Request.objects.create(
        id=uuid.uuid4(), company_name="Active 2", warehouse=warehouse,
        ref_number="A2", load_type="Full", date_time=timezone.now() + timedelta(days=2),
        delivery=True, active=True, approved=False,
    )
    Request.objects.create(
        id=uuid.uuid4(), company_name="Inactive", warehouse=warehouse,
        ref_number="IN", load_type="Full", date_time=timezone.now() + timedelta(days=3),
        delivery=True, active=False, approved=False,
    )
    response = dispatch_client.get("/api/request/")
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_filter_by_approved_true(dispatch_client, warehouse):
    """?approved=true returns only approved requests."""
    Request.objects.create(
        id=uuid.uuid4(), company_name="Approved", warehouse=warehouse,
        ref_number="APP", load_type="Full", date_time=timezone.now() + timedelta(days=1),
        delivery=True, active=True, approved=True,
    )
    Request.objects.create(
        id=uuid.uuid4(), company_name="Pending 1", warehouse=warehouse,
        ref_number="P1", load_type="Full", date_time=timezone.now() + timedelta(days=2),
        delivery=True, active=True, approved=False,
    )
    Request.objects.create(
        id=uuid.uuid4(), company_name="Pending 2", warehouse=warehouse,
        ref_number="P2", load_type="Full", date_time=timezone.now() + timedelta(days=3),
        delivery=True, active=True, approved=False,
    )
    response = dispatch_client.get("/api/request/?approved=true")
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["company_name"] == "Approved"


@pytest.mark.django_db
def test_filter_by_date_range(dispatch_client, warehouse):
    """?start_date=...&end_date=... returns only requests within the range."""
    now = timezone.now()
    Request.objects.create(
        id=uuid.uuid4(), company_name="In Range", warehouse=warehouse,
        ref_number="IR", load_type="Full",
        date_time=now + timedelta(days=5),
        delivery=True, active=True, approved=False,
    )
    Request.objects.create(
        id=uuid.uuid4(), company_name="Out of Range", warehouse=warehouse,
        ref_number="OR", load_type="Full",
        date_time=now + timedelta(days=30),
        delivery=True, active=True, approved=False,
    )
    start = (now + timedelta(days=1)).isoformat().replace("+00:00", "Z")
    end = (now + timedelta(days=10)).isoformat().replace("+00:00", "Z")
    response = dispatch_client.get(f"/api/request/?start_date={start}&end_date={end}")
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["company_name"] == "In Range"


@pytest.mark.django_db
def test_get_single_request_has_nested_customer(dispatch_client, pending_request, customer):
    """Detail response includes a nested customer object (not just an ID)."""
    response = dispatch_client.get(f"/api/request/{pending_request.id}/")
    assert response.status_code == 200
    assert response.data["customer"] is not None
    assert response.data["customer"]["customer_name"] == customer.customer_name


@pytest.mark.django_db
def test_soft_delete_sets_active_false(dispatch_client, pending_request):
    """DELETE sets active=False rather than removing the row."""
    response = dispatch_client.delete(f"/api/request/{pending_request.id}/")
    assert response.status_code in (200, 204)
    pending_request.refresh_from_db()
    assert pending_request.active is False

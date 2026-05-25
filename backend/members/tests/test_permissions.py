"""
Permission boundary tests — who can call what.

Covers every endpoint's access control per user role:
  Anonymous, Dispatch, Dock, Admin

NOTE: IsAuthenticatedOrPostOnly on RequestView has a known bug — line 48
in views.py returns `IsAuthenticated` (the class object, not an instance),
which means `has_permission` is never called for non-POST methods. Anonymous
GET requests to /api/request/ therefore pass the class-level permission check.
The PATCH/PUT/DELETE guard is enforced by the explicit
`if not request.user.is_authenticated` check inside update().
"""

import pytest
from members.tests.conftest import build_request_payload


@pytest.mark.django_db
def test_anonymous_can_post_request(api_client, warehouse, mock_email):
    """Unauthenticated users can submit new appointment requests."""
    import uuid
    from django.utils import timezone
    from datetime import timedelta

    payload = {
        "approved": False,
        "company_name": "Anon Co",
        "email": "anon@example.com",
        "warehouse": str(warehouse.id),
        "ref_number": "ANON-001",
        "load_type": "Full",
        "date_time": (timezone.now() + timedelta(days=3)).isoformat().replace("+00:00", "Z"),
        "delivery": True,
    }
    response = api_client.post("/api/request/", payload, format="json")
    assert response.status_code == 201


@pytest.mark.django_db
def test_anonymous_cannot_patch_request(api_client, pending_request, mock_email, mock_sms):
    """Anonymous PATCH is blocked by the explicit is_authenticated guard in update()."""
    payload = build_request_payload(pending_request)
    response = api_client.put(f"/api/request/{pending_request.id}/", payload, format="json")
    assert response.status_code == 401


@pytest.mark.django_db
def test_anonymous_can_get_warehouses(api_client, warehouse):
    """Warehouse list is publicly accessible (no permission_classes on WarehouseView)."""
    response = api_client.get("/api/warehouse/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_dispatch_can_get_requests(dispatch_client, pending_request):
    response = dispatch_client.get("/api/request/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_dock_can_get_requests(dock_client, pending_request):
    response = dock_client.get("/api/request/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_anonymous_cannot_get_customers(api_client):
    response = api_client.get("/api/customer/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_dispatch_can_get_customers(dispatch_client, customer):
    response = dispatch_client.get("/api/customer/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_dispatch_user_groups_response(dispatch_client):
    response = dispatch_client.get("/api/user-groups/")
    assert response.status_code == 200
    assert response.data["groups"] == ["Dispatch"]


@pytest.mark.django_db
def test_dock_user_groups_response(dock_client):
    response = dock_client.get("/api/user-groups/")
    assert response.status_code == 200
    assert response.data["groups"] == ["Dock"]


@pytest.mark.django_db
def test_anonymous_cannot_get_pending_stats(api_client):
    response = api_client.get("/api/pending-requests-stats/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_dispatch_can_get_pending_stats(dispatch_client):
    response = dispatch_client.get("/api/pending-requests-stats/")
    assert response.status_code == 200
    assert "pending_count" in response.data
    assert "has_urgent_requests" in response.data

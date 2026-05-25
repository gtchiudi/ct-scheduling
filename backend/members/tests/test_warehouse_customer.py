"""
Warehouse and Customer CRUD + search tests.

Covers:
  - Warehouse list (anonymous access), search filter
  - Customer create, list, search, update, soft-delete
"""

import uuid
import pytest
from members.models import Customer, Warehouse


# ===========================================================================
# Warehouse
# ===========================================================================

@pytest.mark.django_db
def test_list_warehouses_anonymous(api_client, warehouse):
    """Warehouses are publicly accessible — no auth required."""
    response = api_client.get("/api/warehouse/")
    assert response.status_code == 200
    assert len(response.data) >= 1
    # Verify expected fields are present
    first = response.data[0]
    for field in ("id", "name", "address", "phone_number", "timezone", "color", "appointments_per_slot"):
        assert field in first


@pytest.mark.django_db
def test_warehouse_search(dispatch_client, db):
    """?search= filters warehouses by name (case-insensitive substring)."""
    Warehouse.objects.create(
        id=uuid.uuid4(), name="Eastside Warehouse", address="1 East St", phone_number="1111111111"
    )
    Warehouse.objects.create(
        id=uuid.uuid4(), name="Westside Depot", address="1 West St", phone_number="2222222222"
    )
    response = dispatch_client.get("/api/warehouse/?search=Eastside")
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Eastside Warehouse"


# ===========================================================================
# Customer
# ===========================================================================

@pytest.mark.django_db
def test_create_customer(dispatch_client):
    response = dispatch_client.post("/api/customer/", {
        "customer_name": "New Customer Inc",
        "email_address": "newcustomer@example.com",
        "send_email_updates": False,
    }, format="json")
    assert response.status_code == 201
    assert response.data["customer_name"] == "New Customer Inc"


@pytest.mark.django_db
def test_list_customers(dispatch_client, customer, customer_with_updates):
    """All active customers are returned."""
    response = dispatch_client.get("/api/customer/")
    assert response.status_code == 200
    names = [c["customer_name"] for c in response.data]
    assert customer.customer_name in names
    assert customer_with_updates.customer_name in names


@pytest.mark.django_db
def test_customer_search(dispatch_client, db):
    """?search= filters by customer_name."""
    Customer.objects.create(id=uuid.uuid4(), customer_name="Alpha Freight")
    Customer.objects.create(id=uuid.uuid4(), customer_name="Beta Shipping")
    response = dispatch_client.get("/api/customer/?search=Alpha")
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["customer_name"] == "Alpha Freight"


@pytest.mark.django_db
def test_update_customer_send_email_flag(dispatch_client, customer):
    """PATCHing send_email_updates persists in the DB."""
    assert customer.send_email_updates is False
    response = dispatch_client.patch(
        f"/api/customer/{customer.id}/",
        {"customer_name": customer.customer_name, "send_email_updates": True},
        format="json",
    )
    assert response.status_code == 200
    customer.refresh_from_db()
    assert customer.send_email_updates is True


@pytest.mark.django_db
def test_customer_soft_delete(dispatch_client, customer):
    """DELETE sets active=False rather than removing the row from the DB."""
    response = dispatch_client.delete(f"/api/customer/{customer.id}/")
    assert response.status_code in (200, 204)
    customer.refresh_from_db()
    assert customer.active is False

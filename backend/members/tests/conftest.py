"""
Shared fixtures for all backend tests.

Provides:
  - Database objects: warehouse, customer, requests, sms_log
  - Auth clients: unauthenticated, dispatch, dock, admin (JWT generated in-process — no HTTP calls)
  - Mock fixtures: mock_email, mock_sms (patch at the call site, not the import site)
"""

import pytest
import uuid
from datetime import timedelta
from django.contrib.auth.models import User, Group
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from members.models import Warehouse, Customer, Request, SmsNumberLog


# ---------------------------------------------------------------------------
# Helper: build an authenticated APIClient using an in-process JWT token.
# This avoids any HTTP call to /token/ and is 100x faster.
# ---------------------------------------------------------------------------
def _make_authed_client(user):
    token = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    return client


def _get_or_create_group(name):
    group, _ = Group.objects.get_or_create(name=name)
    return group


# ---------------------------------------------------------------------------
# Infrastructure fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    """Unauthenticated API client."""
    return APIClient()


@pytest.fixture
def warehouse(db):
    return Warehouse.objects.create(
        id=uuid.uuid4(),
        name="Test Warehouse",
        address="123 Test St",
        phone_number="5551234567",
        timezone="America/New_York",
    )


@pytest.fixture
def customer(db):
    return Customer.objects.create(
        id=uuid.uuid4(),
        customer_name="Acme Corp",
        email_address="",
        send_email_updates=False,
    )


@pytest.fixture
def customer_with_updates(db):
    return Customer.objects.create(
        id=uuid.uuid4(),
        customer_name="Notify Corp",
        email_address="notify@example.com",
        send_email_updates=True,
    )


# ---------------------------------------------------------------------------
# User / group fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def dispatch_user(db):
    user = User.objects.create_user(username="dispatch_test", password="testpass123")
    user.groups.add(_get_or_create_group("Dispatch"))
    return user


@pytest.fixture
def dock_user(db):
    user = User.objects.create_user(username="dock_test", password="testpass123")
    user.groups.add(_get_or_create_group("Dock"))
    return user


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(username="admin_test", password="testpass123")
    user.groups.add(_get_or_create_group("Admin"))
    return user


# ---------------------------------------------------------------------------
# Authenticated client fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def dispatch_client(dispatch_user):
    return _make_authed_client(dispatch_user)


@pytest.fixture
def dock_client(dock_user):
    return _make_authed_client(dock_user)


@pytest.fixture
def admin_client(admin_user):
    return _make_authed_client(admin_user)


# ---------------------------------------------------------------------------
# Request fixtures
# ---------------------------------------------------------------------------

def _future_datetime():
    """Returns a timezone-aware datetime in the future."""
    return timezone.now() + timedelta(days=7)


@pytest.fixture
def pending_request(db, warehouse, customer):
    """An unapproved, active appointment request."""
    return Request.objects.create(
        id=uuid.uuid4(),
        approved=False,
        active=True,
        company_name="Pending Co",
        customer=customer,
        email="pending@example.com",
        warehouse=warehouse,
        ref_number="PO-PENDING",
        load_type="Full",
        date_time=_future_datetime(),
        delivery=True,
    )


@pytest.fixture
def approved_request(db, warehouse, customer):
    """An approved, active appointment request."""
    return Request.objects.create(
        id=uuid.uuid4(),
        approved=True,
        active=True,
        company_name="Approved Co",
        customer=customer,
        email="approved@example.com",
        warehouse=warehouse,
        ref_number="PO-APPROVED",
        load_type="Full",
        date_time=_future_datetime(),
        delivery=False,
    )


@pytest.fixture
def request_with_driver(db, warehouse):
    """An approved request with driver phone and SMS consent."""
    return Request.objects.create(
        id=uuid.uuid4(),
        approved=True,
        active=True,
        company_name="Driver Co",
        email="driver@example.com",
        warehouse=warehouse,
        ref_number="PO-DRIVER",
        load_type="Full",
        date_time=_future_datetime(),
        delivery=True,
        driver_phone_number="+15555550001",
        sms_consent=True,
    )


@pytest.fixture
def sms_log_consented(db):
    """An SmsNumberLog entry with consent=True for +15555550001."""
    return SmsNumberLog.objects.create(
        id=uuid.uuid4(),
        sms_number="+15555550001",
        consent=True,
    )


# ---------------------------------------------------------------------------
# Mock fixtures — always patch at the call site, not the import site
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_email(mocker):
    """Patches send_email in the views module where it is actually called.
    views.py does `from .messages import send_email`, so the live reference
    is `members.views.send_email` — patch there, not at the definition site.
    """
    return mocker.patch("members.views.send_email")


@pytest.fixture
def mock_sms(mocker):
    """Patches send_text in the views module (same import pattern as send_email).
    send_text instantiates the Twilio Client internally; patching send_text
    is simpler and prevents any network calls.
    """
    return mocker.patch("members.views.send_text")


# ---------------------------------------------------------------------------
# Payload builder helper (not a fixture — call directly in tests)
# ---------------------------------------------------------------------------

def build_request_payload(request_obj, overrides=None):
    """
    Build a PUT-compatible dict from a Request model instance.
    Pass overrides to change specific fields for the test.
    """
    payload = {
        "approved": request_obj.approved,
        "active": request_obj.active,
        "company_name": request_obj.company_name,
        "customer_name": request_obj.customer_name or "",
        "customer_id": str(request_obj.customer.id) if request_obj.customer else None,
        "phone_number": request_obj.phone_number or "",
        "email": request_obj.email or "",
        "warehouse": str(request_obj.warehouse.id),
        "ref_number": request_obj.ref_number,
        "load_type": request_obj.load_type,
        "container_drop": request_obj.container_drop,
        "container_number": request_obj.container_number or "",
        "note_section": request_obj.note_section or "",
        "date_time": request_obj.date_time.isoformat().replace("+00:00", "Z"),
        "appointment_length": request_obj.appointment_length,
        "delivery": request_obj.delivery,
        "trailer_number": request_obj.trailer_number or "",
        "driver_phone_number": request_obj.driver_phone_number or "",
        "sms_consent": request_obj.sms_consent,
        "dock_number": request_obj.dock_number,
        "check_in_time": request_obj.check_in_time.isoformat() if request_obj.check_in_time else None,
        "docked_time": request_obj.docked_time.isoformat() if request_obj.docked_time else None,
        "completed_time": request_obj.completed_time.isoformat() if request_obj.completed_time else None,
        "cancelled_time": None,
    }
    if overrides:
        payload.update(overrides)
    return payload

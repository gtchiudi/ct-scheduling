"""
Authentication tests — JWT token lifecycle.

Covers:
  - Obtaining tokens with valid and invalid credentials
  - Refreshing an access token
  - Token blacklisting after rotation
  - Using a valid Bearer token on a protected endpoint
  - Rejection of requests with no token
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.fixture
def auth_user(db):
    return User.objects.create_user(username="authtest", password="securepass123")


@pytest.mark.django_db
def test_obtain_token_valid_credentials(auth_user):
    client = APIClient()
    response = client.post("/token/", {"username": "authtest", "password": "securepass123"})
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_obtain_token_invalid_credentials(auth_user):
    client = APIClient()
    response = client.post("/token/", {"username": "authtest", "password": "wrongpassword"})
    assert response.status_code == 401


@pytest.mark.django_db
def test_refresh_token(auth_user):
    client = APIClient()
    tokens = client.post("/token/", {"username": "authtest", "password": "securepass123"}).data
    response = client.post("/token/refresh/", {"refresh": tokens["refresh"]})
    assert response.status_code == 200
    assert "access" in response.data


@pytest.mark.django_db
def test_blacklisted_refresh_token_rejected(auth_user):
    """After ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION, the old refresh
    token must be rejected on a second use."""
    client = APIClient()
    tokens = client.post("/token/", {"username": "authtest", "password": "securepass123"}).data
    old_refresh = tokens["refresh"]
    # Use it once to rotate
    client.post("/token/refresh/", {"refresh": old_refresh})
    # Second use of the same token must fail
    response = client.post("/token/refresh/", {"refresh": old_refresh})
    assert response.status_code == 401


@pytest.mark.django_db
def test_valid_bearer_token_accepted(auth_user):
    """An in-process generated Bearer token grants access to protected endpoints."""
    token = RefreshToken.for_user(auth_user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")
    response = client.get("/api/user-groups/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_no_token_returns_401():
    """Requests with no Authorization header are rejected on protected endpoints."""
    client = APIClient()
    response = client.get("/api/customer/")
    assert response.status_code == 401

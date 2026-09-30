"""
Audit API tests — /api/audit/events/, /notifications/, /timeline/, /actors/.

Covers permissions per role, every filter, paging, CSV export content and
headers, and the merged timeline ordering.
"""

import csv
import io
import json
import uuid
from datetime import datetime, timedelta

import pytest
import pytz
from django.contrib.auth.models import User
from django.utils import timezone

from members.models import AppointmentEvent, NotificationLog, Request, Warehouse
from members.tests.conftest import _make_authed_client

NY = pytz.timezone("America/New_York")
ENDPOINTS = ["/api/audit/events/", "/api/audit/notifications/", "/api/audit/actors/"]


def ny(y, m, d, h=12, mi=0):
    return NY.localize(datetime(y, m, d, h, mi))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def superuser_client(db):
    return _make_authed_client(User.objects.create_superuser("root", "root@example.com", "pw"))


@pytest.fixture
def other_warehouse(db):
    return Warehouse.objects.create(name="North", address="2 Rd", phone_number="5550000001")


@pytest.fixture
def other_request(db, other_warehouse):
    return Request.objects.create(
        company_name="North Co", email="n@example.com", warehouse=other_warehouse,
        ref_number="N-1;N-2", date_time=timezone.now() + timedelta(days=2))


@pytest.fixture
def dana(db):
    return User.objects.create_user("dana", password="pw", first_name="Dana", last_name="Smith")


@pytest.fixture
def events(approved_request, other_request, dispatch_user, dana):
    """Five events across two appointments/warehouses and three days."""
    E = AppointmentEvent.objects.create
    return {
        "created": E(appointment=approved_request, actor=None, action="created",
                     occurred_at=ny(2026, 9, 1, 8)),
        "imported": E(appointment=approved_request, actor=dispatch_user, action="approved",
                      occurred_at=None),
        "edited": E(appointment=approved_request, actor=dana, action="edited",
                    changes={"note_section": [None, "=HYPERLINK(\"x\")"]}, occurred_at=ny(2026, 9, 2, 23, 30)),
        "north_created": E(appointment=other_request, actor=dana, action="created",
                           occurred_at=ny(2026, 9, 3, 0, 15)),
        "north_cancel": E(appointment=other_request, actor=dispatch_user, action="cancelled",
                          occurred_at=ny(2026, 9, 3, 10)),
    }


@pytest.fixture
def notifications(approved_request, other_request):
    N = NotificationLog.objects.create
    return {
        "approval": N(appointment=approved_request, channel="email", recipient="approved@example.com",
                      kind="approval", subject="Appointment Request Approved - #PO-APPROVED",
                      status="sent", sent_at=ny(2026, 9, 1, 9)),
        "sms_failed": N(appointment=other_request, channel="sms", recipient="+15551230000",
                        kind="dock_ready", status="failed", error="unreachable", sent_at=ny(2026, 9, 2, 9)),
        "team": N(appointment=None, channel="email", recipient="team@candortransport.com",
                  kind="new_request", subject="New Pending Request - #X", status="sent",
                  sent_at=ny(2026, 9, 3, 9)),
    }


def _ids(response):
    return [row["id"] for row in response.data["results"]]


def _csv(response):
    return list(csv.reader(io.StringIO(response.content.decode("utf-8"))))


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.parametrize("url", ENDPOINTS + ["/api/audit/timeline/?appointment=" + str(uuid.uuid4())])
def test_anonymous_gets_401(api_client, url):
    assert api_client.get(url).status_code == 401


@pytest.mark.django_db
@pytest.mark.parametrize("url", ENDPOINTS + ["/api/audit/timeline/?appointment=" + str(uuid.uuid4())])
def test_dock_gets_403(dock_client, url):
    assert dock_client.get(url).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("client_fixture", ["dispatch_client", "admin_client", "superuser_client"])
@pytest.mark.parametrize("url", ENDPOINTS + ["/api/audit/timeline/?appointment=" + str(uuid.uuid4())])
def test_audit_viewers_get_200(request, client_fixture, url):
    client = request.getfixturevalue(client_fixture)
    assert client.get(url).status_code == 200


@pytest.mark.django_db
def test_user_without_groups_gets_403(db):
    client = _make_authed_client(User.objects.create_user("nobody", password="pw"))
    assert client.get("/api/audit/events/").status_code == 403


@pytest.mark.django_db
def test_dock_gets_403_on_csv_export(dock_client):
    assert dock_client.get("/api/audit/events/?export=csv").status_code == 403


@pytest.mark.django_db
def test_audit_endpoints_are_read_only(dispatch_client):
    assert dispatch_client.post("/api/audit/events/", {}, format="json").status_code == 405


# ---------------------------------------------------------------------------
# /events/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_events_newest_first_nulls_last(dispatch_client, events):
    response = dispatch_client.get("/api/audit/events/")
    assert response.data["count"] == 5
    assert _ids(response) == [str(events[k].id) for k in
                              ("north_cancel", "north_created", "edited", "created", "imported")]


@pytest.mark.django_db
def test_event_row_shape(dispatch_client, events, other_request, other_warehouse, dana):
    response = dispatch_client.get(f"/api/audit/events/?appointment={other_request.id}")
    row = response.data["results"][1]
    assert row == {
        "id": str(events["north_created"].id),
        "appointment": str(other_request.id),
        "appointment_ref": "N-1;N-2",
        "appointment_company": "North Co",
        "warehouse": str(other_warehouse.id),
        "warehouse_name": "North",
        "actor": dana.id,
        "actor_name": "Dana Smith",
        "action": "created",
        "changes": {},
        "occurred_at": "2026-09-03T00:15:00-04:00",
    }


@pytest.mark.django_db
def test_actor_name_fallbacks(dispatch_client, approved_request):
    AppointmentEvent.objects.create(appointment=approved_request, action="created")
    AppointmentEvent.objects.create(appointment=approved_request, action="edited",
                                    occurred_at=timezone.now() - timedelta(minutes=1))
    names = {r["action"]: r["actor_name"] for r in dispatch_client.get("/api/audit/events/").data["results"]}
    assert names == {"created": "Request form", "edited": "Unknown"}


@pytest.mark.django_db
def test_actor_name_username_when_no_full_name(dispatch_client, events):
    rows = dispatch_client.get(f"/api/audit/events/?action=cancelled").data["results"]
    assert rows[0]["actor_name"] == "dispatch_test"


@pytest.mark.django_db
def test_events_filter_actor(dispatch_client, events, dana):
    response = dispatch_client.get(f"/api/audit/events/?actor={dana.id}")
    assert set(_ids(response)) == {str(events["edited"].id), str(events["north_created"].id)}


@pytest.mark.django_db
def test_events_filter_actor_none(dispatch_client, events):
    assert _ids(dispatch_client.get("/api/audit/events/?actor=none")) == [str(events["created"].id)]


@pytest.mark.django_db
def test_events_filter_actor_invalid(dispatch_client, events):
    assert dispatch_client.get("/api/audit/events/?actor=abc").status_code == 400


@pytest.mark.django_db
def test_events_filter_action_list(dispatch_client, events):
    response = dispatch_client.get("/api/audit/events/?action=created,cancelled")
    assert set(_ids(response)) == {str(events[k].id) for k in ("created", "north_created", "north_cancel")}


@pytest.mark.django_db
def test_events_filter_warehouse(dispatch_client, events, other_warehouse):
    response = dispatch_client.get(f"/api/audit/events/?warehouse={other_warehouse.id}")
    assert set(_ids(response)) == {str(events["north_created"].id), str(events["north_cancel"].id)}


@pytest.mark.django_db
def test_events_filter_appointment(dispatch_client, events, approved_request):
    response = dispatch_client.get(f"/api/audit/events/?appointment={approved_request.id}")
    assert response.data["count"] == 3


@pytest.mark.django_db
def test_events_date_range_is_inclusive_in_new_york(dispatch_client, events):
    # 23:30 on Sep 2 in New York is Sep 3 in UTC; it must count as Sep 2.
    response = dispatch_client.get("/api/audit/events/?start=2026-09-02&end=2026-09-02")
    assert _ids(response) == [str(events["edited"].id)]
    response = dispatch_client.get("/api/audit/events/?start=2026-09-03")
    assert set(_ids(response)) == {str(events["north_created"].id), str(events["north_cancel"].id)}
    response = dispatch_client.get("/api/audit/events/?end=2026-09-01")
    assert _ids(response) == [str(events["created"].id)]


@pytest.mark.django_db
@pytest.mark.parametrize("query", ["start=09/01/2026", "end=nope", "warehouse=abc", "appointment=123",
                                   "page=0", "page=x", "page_size=-1"])
def test_bad_params_return_400(dispatch_client, query):
    response = dispatch_client.get(f"/api/audit/events/?{query}")
    assert response.status_code == 400
    assert "detail" in response.data


@pytest.mark.django_db
def test_events_paging(dispatch_client, events):
    first = dispatch_client.get("/api/audit/events/?page_size=2")
    assert first.data["count"] == 5
    assert len(first.data["results"]) == 2
    assert first.data["previous"] is None
    assert "page=2" in first.data["next"] and "page_size=2" in first.data["next"]

    second = dispatch_client.get(first.data["next"])
    assert len(second.data["results"]) == 2
    assert "page=3" in second.data["next"]
    assert second.data["previous"] is not None and "page=" not in second.data["previous"]

    third = dispatch_client.get(second.data["next"])
    assert len(third.data["results"]) == 1
    assert third.data["next"] is None
    assert "page=2" in third.data["previous"]

    seen = _ids(first) + _ids(second) + _ids(third)
    assert len(set(seen)) == 5


@pytest.mark.django_db
def test_page_beyond_end_is_empty(dispatch_client, events):
    response = dispatch_client.get("/api/audit/events/?page=9")
    assert response.status_code == 200
    assert response.data["results"] == []
    assert response.data["count"] == 5


@pytest.mark.django_db
def test_page_size_default_and_max(dispatch_client, approved_request):
    AppointmentEvent.objects.bulk_create([
        AppointmentEvent(appointment=approved_request, action="edited",
                         occurred_at=timezone.now() - timedelta(seconds=i))
        for i in range(501)
    ])
    assert len(dispatch_client.get("/api/audit/events/").data["results"]) == 50
    assert len(dispatch_client.get("/api/audit/events/?page_size=1000").data["results"]) == 500


@pytest.mark.django_db
def test_events_csv_export(dispatch_client, events, approved_request):
    response = dispatch_client.get(
        f"/api/audit/events/?export=csv&appointment={approved_request.id}&page_size=1")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert response["Content-Disposition"].startswith('attachment; filename="appointment-activity-')
    assert response["Content-Disposition"].endswith('.csv"')
    rows = _csv(response)
    assert rows[0] == ["occurred_at", "action", "actor_name", "appointment_ref", "appointment_company",
                       "warehouse_name", "changes", "appointment"]
    # Paging ignored: all three rows for this appointment, newest first, null date last.
    assert [r[1] for r in rows[1:]] == ["edited", "created", "approved"]
    edited = rows[1]
    assert edited[0] == "2026-09-02T23:30:00-04:00"
    assert edited[2] == "Dana Smith"
    assert edited[3] == "PO-APPROVED"
    assert edited[4] == "Approved Co"
    assert edited[5] == "Test Warehouse"
    assert json.loads(edited[6]) == {"note_section": [None, "=HYPERLINK(\"x\")"]}
    assert edited[7] == str(approved_request.id)
    assert rows[2][2] == "Request form"
    assert rows[3][0] == ""  # imported approval, date unknown


@pytest.mark.django_db
def test_csv_export_respects_filters(dispatch_client, events):
    rows = _csv(dispatch_client.get("/api/audit/events/?export=csv&action=cancelled"))
    assert len(rows) == 2 and rows[1][1] == "cancelled"


@pytest.mark.django_db
def test_csv_neutralises_formula_injection(dispatch_client, warehouse):
    req = Request.objects.create(company_name="=cmd|' /C calc'!A0", email="x@example.com",
                                 warehouse=warehouse, ref_number="@SUM(1)", date_time=timezone.now())
    AppointmentEvent.objects.create(appointment=req, action="created")
    rows = _csv(dispatch_client.get("/api/audit/events/?export=csv"))
    assert rows[1][3] == "'@SUM(1)"
    assert rows[1][4] == "'=cmd|' /C calc'!A0"


# ---------------------------------------------------------------------------
# /notifications/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_notifications_list_and_shape(dispatch_client, notifications, approved_request):
    response = dispatch_client.get("/api/audit/notifications/")
    assert response.data["count"] == 3
    assert _ids(response) == [str(notifications[k].id) for k in ("team", "sms_failed", "approval")]
    approval = response.data["results"][2]
    assert approval == {
        "id": str(notifications["approval"].id),
        "appointment": str(approved_request.id),
        "appointment_ref": "PO-APPROVED",
        "appointment_company": "Approved Co",
        "warehouse_name": "Test Warehouse",
        "channel": "email",
        "recipient": "approved@example.com",
        "kind": "approval",
        "subject": "Appointment Request Approved - #PO-APPROVED",
        "status": "sent",
        "error": "",
        "sent_at": "2026-09-01T09:00:00-04:00",
    }
    team = response.data["results"][0]
    assert team["appointment"] is None and team["appointment_ref"] is None and team["warehouse_name"] is None


@pytest.mark.django_db
@pytest.mark.parametrize("query,expected", [
    ("channel=sms", ["sms_failed"]),
    ("channel=email", ["team", "approval"]),
    ("kind=approval,new_request", ["team", "approval"]),
    ("status=failed", ["sms_failed"]),
    ("recipient=EXAMPLE.com", ["approval"]),
    ("recipient=555123", ["sms_failed"]),
    ("start=2026-09-02&end=2026-09-02", ["sms_failed"]),
    ("start=2026-09-02", ["team", "sms_failed"]),
])
def test_notifications_filters(dispatch_client, notifications, query, expected):
    response = dispatch_client.get(f"/api/audit/notifications/?{query}")
    assert _ids(response) == [str(notifications[k].id) for k in expected]


@pytest.mark.django_db
def test_notifications_filter_warehouse_and_appointment(dispatch_client, notifications, other_warehouse,
                                                        approved_request):
    assert _ids(dispatch_client.get(f"/api/audit/notifications/?warehouse={other_warehouse.id}")) == \
        [str(notifications["sms_failed"].id)]
    assert _ids(dispatch_client.get(f"/api/audit/notifications/?appointment={approved_request.id}")) == \
        [str(notifications["approval"].id)]


@pytest.mark.django_db
def test_notifications_paging(dispatch_client, notifications):
    response = dispatch_client.get("/api/audit/notifications/?page=2&page_size=2")
    assert _ids(response) == [str(notifications["approval"].id)]
    assert response.data["next"] is None
    assert response.data["previous"] is not None


@pytest.mark.django_db
def test_notifications_csv_export(dispatch_client, notifications):
    response = dispatch_client.get("/api/audit/notifications/?export=csv&status=failed")
    assert response["Content-Type"].startswith("text/csv")
    assert response["Content-Disposition"].startswith('attachment; filename="notifications-')
    rows = _csv(response)
    assert rows[0] == ["sent_at", "channel", "kind", "status", "recipient", "subject", "error",
                       "appointment_ref", "appointment_company", "warehouse_name", "appointment"]
    assert rows[1][:7] == ["2026-09-02T09:00:00-04:00", "sms", "dock_ready", "failed",
                           "+15551230000", "", "unreachable"]
    assert rows[1][7:10] == ["N-1;N-2", "North Co", "North"]
    assert len(rows) == 2


# ---------------------------------------------------------------------------
# /timeline/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_timeline_requires_appointment(dispatch_client):
    assert dispatch_client.get("/api/audit/timeline/").status_code == 400
    assert dispatch_client.get("/api/audit/timeline/?appointment=nope").status_code == 400


@pytest.mark.django_db
def test_timeline_merges_and_orders(dispatch_client, events, notifications, approved_request):
    response = dispatch_client.get(f"/api/audit/timeline/?appointment={approved_request.id}")
    assert response.status_code == 200
    items = response.data
    assert [(i["type"], i["id"]) for i in items] == [
        ("event", str(events["edited"].id)),          # Sep 2 23:30
        ("notification", str(notifications["approval"].id)),  # Sep 1 09:00
        ("event", str(events["created"].id)),         # Sep 1 08:00
        ("event", str(events["imported"].id)),        # date unknown
    ]
    assert items[0] == {
        "type": "event", "at": "2026-09-02T23:30:00-04:00", "id": str(events["edited"].id),
        "action": "edited", "actor_name": "Dana Smith",
        "changes": {"note_section": [None, "=HYPERLINK(\"x\")"]},
    }
    assert items[1] == {
        "type": "notification", "at": "2026-09-01T09:00:00-04:00", "id": str(notifications["approval"].id),
        "channel": "email", "kind": "approval", "recipient": "approved@example.com", "status": "sent",
        "subject": "Appointment Request Approved - #PO-APPROVED", "error": "",
    }
    assert items[2]["actor_name"] == "Request form"
    assert items[3]["at"] is None and items[3]["actor_name"] == "dispatch_test"


@pytest.mark.django_db
def test_timeline_empty_for_unknown_appointment(dispatch_client):
    response = dispatch_client.get(f"/api/audit/timeline/?appointment={uuid.uuid4()}")
    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_timeline_end_to_end_after_real_update(dispatch_client, pending_request):
    """Approving through the API produces an event and a notification on the timeline."""
    from members.tests.conftest import build_request_payload
    dispatch_client.put(f"/api/request/{pending_request.id}/",
                        build_request_payload(pending_request, {"approved": True}), format="json")
    items = dispatch_client.get(f"/api/audit/timeline/?appointment={pending_request.id}").data
    assert {(i["type"], i.get("action") or i.get("kind")) for i in items} == {
        ("event", "approved"), ("notification", "approval")}


# ---------------------------------------------------------------------------
# /actors/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_actors_lists_distinct_event_actors_sorted(dispatch_client, events, dispatch_user, dana, admin_user):
    response = dispatch_client.get("/api/audit/actors/")
    assert response.data == [
        {"id": dana.id, "name": "Dana Smith"},
        {"id": dispatch_user.id, "name": "dispatch_test"},
    ]


# ---------------------------------------------------------------------------
# SPA route
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_audit_log_page_route_serves_spa(client, settings, tmp_path):
    (tmp_path / "index.html").write_text("<html>spa</html>")
    settings.TEMPLATES = [{**settings.TEMPLATES[0], "DIRS": [str(tmp_path)]}]
    response = client.get("/AuditLog")
    assert response.status_code == 200
    assert b"spa" in response.content

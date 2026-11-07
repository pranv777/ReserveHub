import uuid
from datetime import UTC, datetime, timedelta

from tests.helpers import book, count, create_resource, create_slot, create_user, insert_slot


def test_booking_happy_path_and_history(client):
    member = create_user()
    slot = create_slot(create_resource("Room A"))
    r = book(client, member, slot.id)
    assert r.status_code == 201
    b = r.json()
    assert (b["status"], b["source"], b["resource_name"]) == ("confirmed", "direct", "Room A")
    assert b["user_id"] == str(member.id)
    mine = client.get("/api/v1/bookings/me?when=upcoming", headers=member.headers).json()
    assert [x["id"] for x in mine["items"]] == [b["id"]]
    assert client.get(f"/api/v1/bookings/{b['id']}", headers=member.headers).status_code == 200
    notes = client.get("/api/v1/notifications/me", headers=member.headers).json()
    assert notes["items"][0]["type"] == "booking_confirmed"


def test_idempotency_key_required_and_validated(client):
    member, slot = create_user(), create_slot(create_resource())
    r = client.post("/api/v1/bookings", json={"slot_id": str(slot.id)}, headers=member.headers)
    assert (r.status_code, r.json()["error"]["code"]) == (400, "idempotency_key_required")
    r = book(client, member, slot.id, key="short")
    assert r.status_code == 400
    assert count("bookings") == 0 and count("idempotency_records") == 0


def test_same_key_same_request_returns_same_result_without_duplicate(client):
    member, slot = create_user(), create_slot(create_resource())
    first = book(client, member, slot.id, key="key-abcdefgh")
    second = book(client, member, slot.id, key="key-abcdefgh")
    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()
    assert count("bookings") == 1 and count("idempotency_records") == 1
    assert (
        count("notifications") == 1 and count("audit_events", "event_type='booking.created'") == 1
    )


def test_key_reuse_with_different_payload_conflicts(client):
    member = create_user()
    res = create_resource()
    s1, s2 = create_slot(res, start_in_hours=10), create_slot(res, start_in_hours=20)
    assert book(client, member, s1.id, key="key-abcdefgh").status_code == 201
    r = book(client, member, s2.id, key="key-abcdefgh")
    assert (r.status_code, r.json()["error"]["code"]) == (409, "idempotency_key_reuse")
    assert count("bookings") == 1


def test_keys_are_scoped_per_user(client):
    a, b = create_user(), create_user()
    res = create_resource()
    s1, s2 = create_slot(res, start_in_hours=10), create_slot(res, start_in_hours=20)
    assert book(client, a, s1.id, key="shared-key-1").status_code == 201
    assert book(client, b, s2.id, key="shared-key-1").status_code == 201


def test_losing_booking_leaves_no_partial_records(client):
    a, b = create_user(), create_user()
    slot = create_slot(create_resource())
    assert book(client, a, slot.id).status_code == 201
    r = book(client, b, slot.id, key="loser-key-001")
    assert (r.status_code, r.json()["error"]["code"]) == (409, "slot_unavailable")
    assert count("bookings") == 1
    assert count("idempotency_records") == 1  # loser's record rolled back with its transaction
    assert count("notifications", f"user_id='{b.id}'") == 0
    assert count("audit_events", f"actor_id='{b.id}'") == 0


def test_booking_failure_midway_rolls_everything_back(nosrv_client, monkeypatch):
    member, slot = create_user(), create_slot(create_resource())

    def boom(*a, **k):
        raise RuntimeError("notification store down")

    monkeypatch.setattr("app.services.bookings.notify", boom)
    r = book(nosrv_client, member, slot.id)
    assert r.status_code == 500 and r.json()["error"]["code"] == "internal_error"
    assert "notification store" not in r.text
    assert count("bookings") == 0 and count("idempotency_records") == 0
    assert count("audit_events") == 0
    monkeypatch.undo()
    assert book(nosrv_client, member, slot.id).status_code == 201  # retriable


def test_unknown_slot_past_slot_and_bad_ids(client):
    member = create_user()
    assert book(client, member, uuid.uuid4()).status_code == 404
    past = insert_slot(
        create_resource(),
        datetime.now(UTC) - timedelta(hours=2),
        datetime.now(UTC) - timedelta(hours=1),
    )
    r = book(client, member, past.id)
    assert (r.status_code, r.json()["error"]["code"]) == (409, "slot_in_past")
    r = client.post(
        "/api/v1/bookings",
        json={"slot_id": "nope"},
        headers={**member.headers, "Idempotency-Key": "abcdefgh12"},
    )
    assert r.status_code == 422


def test_members_cannot_see_or_cancel_others_bookings(client):
    owner, intruder = create_user(), create_user()
    slot = create_slot(create_resource())
    bid = book(client, owner, slot.id).json()["id"]
    assert client.get(f"/api/v1/bookings/{bid}", headers=intruder.headers).status_code == 404
    r = client.post(f"/api/v1/bookings/{bid}/cancel", headers=intruder.headers)
    assert (r.status_code, r.json()["error"]["code"]) == (404, "booking_not_found")
    assert client.get("/api/v1/bookings/me", headers=intruder.headers).json()["total"] == 0
    still = client.get(f"/api/v1/bookings/{bid}", headers=owner.headers).json()
    assert still["status"] == "confirmed"


def test_cancel_lifecycle_and_invalid_transitions(client):
    member, slot = create_user(), create_slot(create_resource())
    bid = book(client, member, slot.id).json()["id"]
    r = client.post(f"/api/v1/bookings/{bid}/cancel", headers=member.headers)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled" and r.json()["cancelled_at"]
    again = client.post(f"/api/v1/bookings/{bid}/cancel", headers=member.headers)
    assert (again.status_code, again.json()["error"]["code"]) == (409, "invalid_state_transition")
    assert client.get(f"/api/v1/slots/{slot.id}", headers=member.headers).json()["is_available"]
    assert book(client, member, slot.id).status_code == 201  # can rebook after cancelling
    history = client.get("/api/v1/bookings/me", headers=member.headers).json()
    assert history["total"] == 2  # cancelled booking retained


def test_cannot_cancel_after_slot_started(client, db):
    from sqlalchemy import text

    member, slot = create_user(), create_slot(create_resource())
    bid = book(client, member, slot.id).json()["id"]
    db.execute(
        text(
            "UPDATE availability_slots SET start_at = now() - interval '10 minutes', "
            "end_at = now() + interval '50 minutes' WHERE id = :i"
        ),
        {"i": str(slot.id)},
    )
    db.commit()
    r = client.post(f"/api/v1/bookings/{bid}/cancel", headers=member.headers)
    assert (r.status_code, r.json()["error"]["code"]) == (409, "cancellation_window_closed")


def test_admin_booking_view_and_filters(client):
    admin, a, b = create_user("admin"), create_user(), create_user()
    res = create_resource()
    s1, s2 = create_slot(res, start_in_hours=10), create_slot(res, start_in_hours=20)
    book(client, a, s1.id)
    bid = book(client, b, s2.id).json()["id"]
    client.post(f"/api/v1/bookings/{bid}/cancel", headers=b.headers)
    allb = client.get("/api/v1/admin/bookings", headers=admin.headers).json()
    assert allb["total"] == 2 and allb["items"][0]["user_email"]
    only = client.get("/api/v1/admin/bookings?status=cancelled", headers=admin.headers).json()
    assert [x["id"] for x in only["items"]] == [bid]
    assert (
        client.get("/api/v1/admin/bookings?status=bogus", headers=admin.headers).status_code == 422
    )
    kinds = {
        e["event_type"]
        for e in client.get("/api/v1/admin/audit-events", headers=admin.headers).json()["items"]
    }
    assert {"booking.created", "booking.cancelled"} <= kinds


def test_notifications_read_only_for_owner(client):
    a, b = create_user(), create_user()
    slot = create_slot(create_resource())
    book(client, a, slot.id)
    nid = client.get("/api/v1/notifications/me", headers=a.headers).json()["items"][0]["id"]
    assert client.post(f"/api/v1/notifications/{nid}/read", headers=b.headers).status_code == 404
    r = client.post(f"/api/v1/notifications/{nid}/read", headers=a.headers)
    assert r.status_code == 200 and r.json()["read_at"]
    unread = client.get("/api/v1/notifications/me?unread_only=true", headers=a.headers).json()
    assert unread["total"] == 0

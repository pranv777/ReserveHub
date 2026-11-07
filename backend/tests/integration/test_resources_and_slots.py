from datetime import UTC, datetime, timedelta

from tests.helpers import book, count, create_resource, create_slot, create_user, insert_slot


def iso(dt):
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def future(hours):
    return datetime.now(UTC) + timedelta(hours=hours)


def test_admin_resource_lifecycle_and_audit(client):
    admin = create_user("admin")
    r = client.post(
        "/api/v1/resources",
        headers=admin.headers,
        json={"name": "  Studio 1 ", "location": "Floor 3", "category": "room", "capacity": 4},
    )
    assert r.status_code == 201
    rid = r.json()["id"]
    assert r.json()["name"] == "Studio 1"
    r = client.patch(
        f"/api/v1/resources/{rid}", headers=admin.headers, json={"description": "Quiet"}
    )
    assert r.status_code == 200 and r.json()["description"] == "Quiet"
    r = client.post(f"/api/v1/resources/{rid}/deactivate", headers=admin.headers)
    assert r.status_code == 200 and r.json()["is_active"] is False
    events = client.get("/api/v1/admin/audit-events", headers=admin.headers).json()
    kinds = {e["event_type"] for e in events["items"]}
    assert {"resource.created", "resource.updated", "resource.deactivated"} <= kinds


def test_resource_validation_uses_error_envelope(client):
    admin = create_user("admin")
    for payload in ({"name": ""}, {"name": "x" * 121}, {"name": "ok", "capacity": 0}, {}):
        r = client.post("/api/v1/resources", headers=admin.headers, json=payload)
        assert r.status_code == 422
        err = r.json()["error"]
        assert err["code"] == "validation_error" and err["request_id"] and err["details"]


def test_members_only_see_active_resources(client):
    member = create_user()
    create_resource("Active")
    inactive = create_resource("Hidden", active=False)
    names = [
        r["name"] for r in client.get("/api/v1/resources", headers=member.headers).json()["items"]
    ]
    assert names == ["Active"]
    assert client.get(f"/api/v1/resources/{inactive.id}", headers=member.headers).status_code == 404
    r = client.get("/api/v1/resources?include_inactive=true", headers=member.headers)
    assert [x["name"] for x in r.json()["items"]] == ["Active"]  # flag ignored for members


def test_slot_creation_rules(client):
    admin = create_user("admin")
    res = create_resource()
    url = f"/api/v1/resources/{res.id}/slots"

    def post(start, end):
        return client.post(
            url, headers=admin.headers, json={"start_at": iso(start), "end_at": iso(end)}
        )

    ok = post(future(10), future(11))
    assert ok.status_code == 201 and ok.json()["is_available"] is True
    assert post(future(12), future(11)).json()["error"]["code"] == "invalid_time_range"
    assert post(future(-3), future(-2)).json()["error"]["code"] == "slot_in_past"
    assert post(future(10.5), future(11.5)).json()["error"]["code"] == "slot_overlap"
    assert post(future(11), future(12)).status_code == 201  # back-to-back allowed
    naive = client.post(
        url,
        headers=admin.headers,
        json={"start_at": "2030-01-01T10:00:00", "end_at": "2030-01-01T11:00:00"},
    )
    assert naive.status_code == 422  # timezone-aware timestamps are required
    client.post(f"/api/v1/resources/{res.id}/deactivate", headers=admin.headers)
    assert post(future(20), future(21)).json()["error"]["code"] == "resource_inactive"


def test_booked_slot_cannot_be_rescheduled(client):
    admin, member = create_user("admin"), create_user()
    slot = create_slot(create_resource())
    body = {"start_at": iso(future(40)), "end_at": iso(future(41))}
    assert (
        client.patch(f"/api/v1/slots/{slot.id}", headers=admin.headers, json=body).status_code
        == 200
    )
    assert book(client, member, slot.id).status_code == 201
    r = client.patch(f"/api/v1/slots/{slot.id}", headers=admin.headers, json=body)
    assert (r.status_code, r.json()["error"]["code"]) == (409, "slot_has_booking")


def test_availability_is_derived_from_bookings(client):
    member = create_user()
    slot = create_slot(create_resource())
    get = lambda: client.get(f"/api/v1/slots/{slot.id}", headers=member.headers).json()  # noqa: E731
    assert get()["is_available"] is True
    assert book(client, member, slot.id).status_code == 201
    state = get()
    assert state["is_available"] is False and state["booked_by_me"] is True
    listed = client.get("/api/v1/slots?available_only=true", headers=member.headers).json()
    assert listed["total"] == 0


def test_deactivation_keeps_history_and_blocks_new_bookings(client):
    admin, member, other = create_user("admin"), create_user(), create_user()
    res = create_resource()
    s1, s2 = create_slot(res, start_in_hours=10), create_slot(res, start_in_hours=20)
    assert book(client, member, s1.id).status_code == 201
    client.post(f"/api/v1/resources/{res.id}/deactivate", headers=admin.headers)
    assert count("bookings") == 1  # history preserved
    r = book(client, other, s2.id)
    assert (r.status_code, r.json()["error"]["code"]) == (409, "resource_inactive")
    mine = client.get("/api/v1/bookings/me", headers=member.headers).json()
    assert mine["total"] == 1  # still visible to its owner


def test_slot_search_filters_pagination_and_stable_order(client):
    member = create_user()
    r1 = create_resource("Alpha", location="North", category="room")
    r2 = create_resource("Beta", location="South", category="desk")
    for i in range(7):
        create_slot(r1, start_in_hours=10 + i * 2)
    for i in range(3):
        create_slot(r2, start_in_hours=11 + i * 2)
    h = member.headers
    seen, page = [], 1
    while True:
        data = client.get(f"/api/v1/slots?page={page}&page_size=4", headers=h).json()
        assert data["total"] == 10
        seen += [s["id"] for s in data["items"]]
        if len(data["items"]) < 4:
            break
        page += 1
    assert len(seen) == len(set(seen)) == 10  # no duplicates or gaps across pages
    starts = [
        s["start_at"]
        for p in (1, 2, 3)
        for s in client.get(f"/api/v1/slots?page={p}&page_size=4", headers=h).json()["items"]
    ]
    assert starts == sorted(starts)
    assert client.get("/api/v1/slots?location=South", headers=h).json()["total"] == 3
    assert client.get("/api/v1/slots?category=room", headers=h).json()["total"] == 7
    assert client.get(f"/api/v1/slots?resource_id={r2.id}", headers=h).json()["total"] == 3
    assert client.get("/api/v1/slots?page_size=101", headers=h).status_code == 422
    assert client.get("/api/v1/slots?page=0", headers=h).status_code == 422


def test_past_slots_are_not_listed(client):
    member = create_user()
    res = create_resource()
    insert_slot(res, future(-5), future(-4))
    create_slot(res)
    assert client.get("/api/v1/slots", headers=member.headers).json()["total"] == 1

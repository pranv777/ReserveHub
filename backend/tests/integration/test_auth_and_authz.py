import uuid

from tests.helpers import create_resource, create_slot, create_user, make_token


def test_unauthenticated_rejected(client):
    for path in (
        "/api/v1/resources",
        "/api/v1/slots",
        "/api/v1/bookings/me",
        "/api/v1/me",
        "/api/v1/admin/bookings",
        "/api/v1/notifications/me",
    ):
        assert client.get(path).status_code == 401


def test_expired_and_forged_tokens(client):
    uid = uuid.uuid4()
    r = client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {make_token(uid, expires_in=-5)}"}
    )
    assert (r.status_code, r.json()["error"]["code"]) == (401, "token_expired")
    r = client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {make_token(uid, secret='z' * 40)}"}
    )
    assert (r.status_code, r.json()["error"]["code"]) == (401, "invalid_token")


def test_valid_token_creates_member_profile_on_first_request(client):
    uid = uuid.uuid4()
    r = client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {make_token(uid, 'new@example.test')}"}
    )
    assert r.status_code == 200
    assert r.json()["role"] == "member"
    assert r.json()["email"] == "new@example.test"


def test_role_claims_in_token_are_ignored(client):
    uid = uuid.uuid4()
    token = make_token(
        uid, role="admin", app_metadata={"role": "admin"}, user_metadata={"role": "admin"}
    )
    h = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/me", headers=h).json()["role"] == "member"
    assert client.post("/api/v1/resources", json={"name": "X"}, headers=h).status_code == 403


def test_member_cannot_use_admin_endpoints(client):
    member = create_user()
    res = create_resource()
    slot = create_slot(res)
    h = member.headers
    assert client.post("/api/v1/resources", json={"name": "X"}, headers=h).status_code == 403
    assert (
        client.patch(f"/api/v1/resources/{res.id}", json={"name": "Y"}, headers=h).status_code
        == 403
    )
    assert client.post(f"/api/v1/resources/{res.id}/deactivate", headers=h).status_code == 403
    body = {"start_at": "2030-01-01T10:00:00Z", "end_at": "2030-01-01T11:00:00Z"}
    assert client.post(f"/api/v1/resources/{res.id}/slots", json=body, headers=h).status_code == 403
    assert client.patch(f"/api/v1/slots/{slot.id}", json=body, headers=h).status_code == 403
    assert (
        client.get("/api/v1/admin/bookings", headers=h).json()["error"]["code"] == "admin_required"
    )
    assert client.get("/api/v1/admin/audit-events", headers=h).status_code == 403


def test_disabled_account_is_forbidden(client):
    user = create_user(active=False)
    r = client.get("/api/v1/me", headers=user.headers)
    assert (r.status_code, r.json()["error"]["code"]) == (403, "account_disabled")

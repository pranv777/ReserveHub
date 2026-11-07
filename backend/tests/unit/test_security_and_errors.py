import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core import errors
from app.core.security import verify_access_token
from app.main import create_app
from tests.helpers import SECRET, make_token


def test_valid_token_returns_claims():
    uid = uuid.uuid4()
    assert verify_access_token(make_token(uid))["sub"] == str(uid)


@pytest.mark.parametrize(
    ("token", "code"),
    [
        (make_token(uuid.uuid4(), expires_in=-10), "token_expired"),
        (make_token(uuid.uuid4(), secret="x" * 40), "invalid_token"),
        (make_token(uuid.uuid4(), aud="other"), "invalid_token"),
        ("not-a-jwt", "invalid_token"),
        (
            jwt.encode({"sub": "abc", "aud": "authenticated"}, SECRET, algorithm="HS256"),
            "invalid_token",
        ),
    ],
)
def test_bad_tokens_rejected(token, code):
    with pytest.raises(errors.UnauthorizedError) as exc:
        verify_access_token(token)
    assert exc.value.code == code


def test_error_conversion_uses_documented_envelope():
    app = create_app()

    def make(exc):
        def raiser():
            raise exc

        return raiser

    cases = {
        "/bad": errors.BadRequestError("m", code="c_bad"),
        "/unauth": errors.UnauthorizedError("m"),
        "/forbid": errors.ForbiddenError("m"),
        "/missing": errors.NotFoundError("m"),
        "/conflict": errors.ConflictError("m", code="c_conf"),
    }
    for path, exc in cases.items():
        app.get(path)(make(exc))
    app.get("/boom")(make(RuntimeError("secret internals")))
    client = TestClient(app, raise_server_exceptions=False)
    expected = {"/bad": 400, "/unauth": 401, "/forbid": 403, "/missing": 404, "/conflict": 409}
    for path, status in expected.items():
        r = client.get(path, headers={"X-Request-ID": "req-123"})
        assert r.status_code == status
        body = r.json()["error"]
        assert body["code"] == cases[path].code
        assert body["request_id"] == "req-123"
        assert r.headers["x-request-id"] == "req-123"
    r = client.get("/boom")
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "internal_error"
    assert "secret" not in r.text  # no internals leaked


def test_unknown_route_and_liveness_without_database():
    client = TestClient(create_app())
    assert client.get("/api/v1/health/live").json() == {"status": "ok"}
    r = client.get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"
    assert r.headers["x-request-id"]


def test_missing_token_is_401_envelope():
    r = TestClient(create_app()).get("/api/v1/resources")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "not_authenticated"

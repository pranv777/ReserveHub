import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from app.db.session import get_sessionmaker
from app.models import Profile, Resource, Slot

SECRET = "test-secret-test-secret-test-secret-123456"  # noqa: S105


@dataclass
class User:
    id: uuid.UUID
    email: str
    role: str

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {make_token(self.id, self.email)}"}


def make_token(
    user_id, email=None, *, expires_in=3600, secret=SECRET, aud="authenticated", **extra
):
    now = int(time.time())
    claims = {"sub": str(user_id), "aud": aud, "iat": now, "exp": now + expires_in, **extra}
    if email:
        claims["email"] = email
    return jwt.encode(claims, secret, algorithm="HS256")


def create_user(role: str = "member", active: bool = True) -> User:
    uid = uuid.uuid4()
    email = f"{uid.hex[:8]}@example.test"
    with get_sessionmaker()() as s:
        s.add(Profile(id=uid, email=email, role=role, is_active=active))
        s.commit()
    return User(uid, email, role)


def create_resource(name: str = "Room A", active: bool = True, **kw) -> Resource:
    with get_sessionmaker()() as s:
        r = Resource(name=name, is_active=active, **kw)
        s.add(r)
        s.commit()
        return r


def create_slot(resource: Resource, *, start_in_hours: float = 24, hours: float = 1) -> Slot:
    start = datetime.now(UTC) + timedelta(hours=start_in_hours)
    return insert_slot(resource, start, start + timedelta(hours=hours))


def insert_slot(resource: Resource, start: datetime, end: datetime) -> Slot:
    with get_sessionmaker()() as s:
        slot = Slot(resource_id=resource.id, start_at=start, end_at=end)
        s.add(slot)
        s.commit()
        return slot


def book(client, user: User, slot_id, key: str | None = None):
    return client.post(
        "/api/v1/bookings",
        json={"slot_id": str(slot_id)},
        headers={**user.headers, "Idempotency-Key": key or uuid.uuid4().hex},
    )


def count(table: str, where: str = "true") -> int:
    from sqlalchemy import text

    with get_sessionmaker()() as s:
        return s.execute(text(f"SELECT count(*) FROM {table} WHERE {where}")).scalar_one()  # noqa: S608

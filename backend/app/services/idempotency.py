"""Idempotency protocol (see docs/decisions/0003-idempotency.md).

The record is INSERTed in the same transaction as the operation. Because of the unique
constraint, a concurrent duplicate blocks on ``ON CONFLICT DO NOTHING`` until the first
transaction commits (then it replays the stored result) or rolls back (then it proceeds
itself). A record is therefore only ever visible together with its committed outcome.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.errors import ConflictError
from app.models.idempotency import IdempotencyRecord


@dataclass
class Claim:
    record_id: uuid.UUID
    replay: tuple[int, dict[str, Any]] | None


def claim(db: Session, user_id: uuid.UUID, scope: str, key: str, fingerprint: str) -> Claim:
    stmt = (
        pg_insert(IdempotencyRecord)
        .values(user_id=user_id, scope=scope, key=key, request_fingerprint=fingerprint)
        .on_conflict_do_nothing(index_elements=["user_id", "scope", "key"])
        .returning(IdempotencyRecord.id)
    )
    new_id = db.execute(stmt).scalar_one_or_none()
    if new_id is not None:
        return Claim(new_id, None)

    rec = db.execute(
        select(IdempotencyRecord)
        .where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.scope == scope,
            IdempotencyRecord.key == key,
        )
        .execution_options(populate_existing=True)
    ).scalar_one()
    if rec.request_fingerprint != fingerprint:
        raise ConflictError(
            "This Idempotency-Key was already used with a different request.",
            code="idempotency_key_reuse",
        )
    if rec.response_status is None or rec.response_body is None:
        raise ConflictError(
            "The original request is still in progress.", code="idempotency_in_progress"
        )
    return Claim(rec.id, (rec.response_status, rec.response_body))


def complete(db: Session, record_id: uuid.UUID, status: int, body: dict[str, Any]) -> None:
    db.execute(
        update(IdempotencyRecord)
        .where(IdempotencyRecord.id == record_id)
        .values(response_status=status, response_body=body)
    )

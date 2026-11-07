"""Audit/notification writers. They only add rows to the caller's transaction."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.notification import Notification


def record_audit(
    db: Session,
    event_type: str,
    actor_id: uuid.UUID | None,
    target_type: str,
    target_id: uuid.UUID | None,
    metadata: dict[str, Any] | None = None,
) -> None:
    # Metadata must stay non-sensitive: ids, names of resources, counts. Never tokens/emails.
    db.add(
        AuditEvent(
            actor_id=actor_id,
            event_type=event_type,
            target_type=target_type,
            target_id=target_id,
            meta=metadata or {},
        )
    )


def notify(
    db: Session,
    user_id: uuid.UUID,
    type_: str,
    message: str,
    slot_id: uuid.UUID | None = None,
    booking_id: uuid.UUID | None = None,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            type=type_,
            message=message[:255],
            slot_id=slot_id,
            booking_id=booking_id,
        )
    )

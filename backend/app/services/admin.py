import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.schemas.bookings import AuditEventOut
from app.services.pagination import paginate


def list_audit_events(
    db: Session,
    page: int,
    page_size: int,
    *,
    event_type: str | None,
    actor_id: uuid.UUID | None,
    target_type: str | None,
    created_from: datetime | None,
    created_to: datetime | None,
):
    stmt = select(AuditEvent)
    if event_type:
        stmt = stmt.where(AuditEvent.event_type == event_type)
    if actor_id:
        stmt = stmt.where(AuditEvent.actor_id == actor_id)
    if target_type:
        stmt = stmt.where(AuditEvent.target_type == target_type)
    if created_from:
        stmt = stmt.where(AuditEvent.created_at >= created_from)
    if created_to:
        stmt = stmt.where(AuditEvent.created_at < created_to)
    stmt = stmt.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
    rows, total = paginate(db, stmt, page, page_size)
    items = [
        AuditEventOut(
            id=e.id,
            actor_id=e.actor_id,
            event_type=e.event_type,
            target_type=e.target_type,
            target_id=e.target_id,
            metadata=e.meta,
            created_at=e.created_at,
        )
        for (e,) in rows
    ]
    return items, total

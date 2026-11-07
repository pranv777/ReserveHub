import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.time import utcnow
from app.models.notification import Notification
from app.models.profile import Profile
from app.services.pagination import paginate


def list_notifications(db: Session, user: Profile, page: int, page_size: int, unread_only: bool):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    stmt = stmt.order_by(Notification.created_at.desc(), Notification.id.desc())
    rows, total = paginate(db, stmt, page, page_size)
    return [r[0] for r in rows], total


def mark_read(db: Session, user: Profile, notification_id: uuid.UUID) -> Notification:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise NotFoundError("Notification not found.", code="notification_not_found")
    if n.read_at is None:
        n.read_at = utcnow()
    return n

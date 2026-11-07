import uuid

from fastapi import APIRouter

from app.api.deps import COMMON_ERRORS, DB, CurrentUser, PageParam, PageSizeParam
from app.schemas.bookings import NotificationOut
from app.schemas.common import Page
from app.services import notifications as svc

router = APIRouter(prefix="/notifications", tags=["notifications"], responses=COMMON_ERRORS)


def _out(n) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        type=n.type,
        message=n.message,
        slot_id=n.slot_id,
        booking_id=n.booking_id,
        read_at=n.read_at,
        created_at=n.created_at,
    )


@router.get("/me", response_model=Page[NotificationOut], summary="My notifications")
def mine(
    db: DB,
    user: CurrentUser,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
    unread_only: bool = False,
):
    items, total = svc.list_notifications(db, user, page, page_size, unread_only)
    return Page[NotificationOut](
        items=[_out(n) for n in items], total=total, page=page, page_size=page_size
    )


@router.post("/{notification_id}/read", response_model=NotificationOut, summary="Mark as read")
def read(notification_id: uuid.UUID, db: DB, user: CurrentUser):
    n = svc.mark_read(db, user, notification_id)
    db.commit()
    return _out(n)

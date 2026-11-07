import uuid

from fastapi import APIRouter, Response

from app.api.deps import COMMON_ERRORS, DB, CurrentUser, PageParam, PageSizeParam
from app.schemas.bookings import WaitlistEntryOut
from app.schemas.common import Page
from app.services import waitlist as svc

router = APIRouter(tags=["waitlist"], responses=COMMON_ERRORS)


@router.post(
    "/slots/{slot_id}/waitlist",
    response_model=WaitlistEntryOut,
    status_code=201,
    summary="Join the waitlist for a booked slot",
)
def join(slot_id: uuid.UUID, db: DB, user: CurrentUser):
    entry_id = svc.join_waitlist(db, user, slot_id)
    db.commit()
    return svc.get_entry_out(db, user, entry_id)


@router.get("/waitlist/me", response_model=Page[WaitlistEntryOut], summary="My waitlist entries")
def mine(
    db: DB,
    user: CurrentUser,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
    active_only: bool = False,
):
    items, total = svc.list_my_entries(db, user, page, page_size, active_only)
    return Page[WaitlistEntryOut](items=items, total=total, page=page, page_size=page_size)


@router.delete("/waitlist/{entry_id}", status_code=204, summary="Leave the waitlist")
def leave(entry_id: uuid.UUID, db: DB, user: CurrentUser) -> Response:
    svc.leave_waitlist(db, user, entry_id)
    db.commit()
    return Response(status_code=204)

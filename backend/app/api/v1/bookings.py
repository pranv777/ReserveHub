import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Header, Response

from app.api.deps import COMMON_ERRORS, DB, CurrentUser, PageParam, PageSizeParam
from app.core.errors import BadRequestError
from app.schemas.bookings import BookingCreate, BookingOut
from app.schemas.common import Page
from app.services import bookings as svc

router = APIRouter(prefix="/bookings", tags=["bookings"], responses=COMMON_ERRORS)


@router.post(
    "",
    response_model=BookingOut,
    status_code=201,
    summary="Book a slot (requires an Idempotency-Key header)",
)
def create_booking(
    payload: BookingCreate,
    response: Response,
    db: DB,
    user: CurrentUser,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    key = (idempotency_key or "").strip()
    if not 8 <= len(key) <= 128:
        raise BadRequestError(
            "An Idempotency-Key header of 8-128 characters is required.",
            code="idempotency_key_required",
        )
    status, body = svc.create_booking(db, user, payload.slot_id, key)
    db.commit()
    response.status_code = status
    return body


@router.get("/me", response_model=Page[BookingOut], summary="My bookings (paginated)")
def my_bookings(
    db: DB,
    user: CurrentUser,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
    when: Literal["all", "upcoming", "past"] = "all",
):
    items, total = svc.list_my_bookings(db, user, page, page_size, when)
    return Page[BookingOut](items=items, total=total, page=page, page_size=page_size)


@router.get("/{booking_id}", response_model=BookingOut, summary="Get one of my bookings")
def get_booking(booking_id: uuid.UUID, db: DB, user: CurrentUser):
    return svc.get_booking(db, user, booking_id)


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingOut,
    summary="Cancel my booking; promotes the oldest eligible waitlist entry atomically",
)
def cancel_booking(booking_id: uuid.UUID, db: DB, user: CurrentUser):
    result = svc.cancel_booking(db, user, booking_id)
    db.commit()
    return result

import uuid
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import AwareDatetime

from app.api.deps import COMMON_ERRORS, DB, AdminUser, PageParam, PageSizeParam
from app.schemas.bookings import AdminBookingOut, AuditEventOut
from app.schemas.common import Page
from app.services import admin as admin_svc
from app.services import bookings as booking_svc

router = APIRouter(prefix="/admin", tags=["admin"], responses=COMMON_ERRORS)


@router.get("/bookings", response_model=Page[AdminBookingOut], summary="All bookings (admin)")
def bookings(
    db: DB,
    _: AdminUser,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
    resource_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    status: Literal["confirmed", "cancelled"] | None = None,
    start_from: AwareDatetime | None = None,
    start_to: AwareDatetime | None = None,
):
    items, total = booking_svc.list_admin_bookings(
        db,
        page,
        page_size,
        resource_id=resource_id,
        user_id=user_id,
        status=status,
        start_from=start_from,
        start_to=start_to,
    )
    return Page[AdminBookingOut](items=items, total=total, page=page, page_size=page_size)


@router.get("/audit-events", response_model=Page[AuditEventOut], summary="Audit timeline (admin)")
def audit_events(
    db: DB,
    _: AdminUser,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
    event_type: str | None = Query(None, max_length=60),
    actor_id: uuid.UUID | None = None,
    target_type: str | None = Query(None, max_length=40),
    created_from: AwareDatetime | None = None,
    created_to: AwareDatetime | None = None,
):
    items, total = admin_svc.list_audit_events(
        db,
        page,
        page_size,
        event_type=event_type,
        actor_id=actor_id,
        target_type=target_type,
        created_from=created_from,
        created_to=created_to,
    )
    return Page[AuditEventOut](items=items, total=total, page=page, page_size=page_size)

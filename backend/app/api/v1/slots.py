import uuid
from datetime import datetime

from fastapi import APIRouter, Query
from pydantic import AwareDatetime

from app.api.deps import COMMON_ERRORS, DB, AdminUser, CurrentUser, PageParam, PageSizeParam
from app.schemas.common import Page
from app.schemas.slots import SlotCreate, SlotOut, SlotUpdate
from app.services import slots as svc

router = APIRouter(tags=["slots"], responses=COMMON_ERRORS)


@router.get("/slots", response_model=Page[SlotOut], summary="Search future slots (paginated)")
def list_slots(
    db: DB,
    user: CurrentUser,
    page: PageParam = 1,
    page_size: PageSizeParam = 20,
    resource_id: uuid.UUID | None = None,
    start_from: AwareDatetime | None = None,
    start_to: AwareDatetime | None = None,
    location: str | None = Query(None, max_length=120),
    category: str | None = Query(None, max_length=60),
    available_only: bool = False,
    include_inactive: bool = False,
):
    items, total = svc.list_slots(
        db,
        user,
        page,
        page_size,
        resource_id=resource_id,
        start_from=start_from,
        start_to=start_to,
        location=location,
        category=category,
        available_only=available_only,
        include_inactive=include_inactive,
    )
    return Page[SlotOut](items=items, total=total, page=page, page_size=page_size)


@router.get("/slots/{slot_id}", response_model=SlotOut, summary="Get a slot with live availability")
def get_slot(slot_id: uuid.UUID, db: DB, user: CurrentUser):
    return svc.get_slot_out(db, user, slot_id)


@router.post(
    "/resources/{resource_id}/slots",
    response_model=SlotOut,
    status_code=201,
    summary="Create a future slot (admin)",
)
def create_slot(resource_id: uuid.UUID, data: SlotCreate, db: DB, admin: AdminUser):
    slot_id = svc.create_slot(db, admin, resource_id, data)
    db.commit()
    return svc.get_slot_out(db, admin, slot_id)


@router.patch(
    "/slots/{slot_id}", response_model=SlotOut, summary="Reschedule an unbooked slot (admin)"
)
def update_slot(slot_id: uuid.UUID, data: SlotUpdate, db: DB, admin: AdminUser):
    svc.update_slot(db, admin, slot_id, data)
    db.commit()
    return svc.get_slot_out(db, admin, slot_id)


_ = datetime  # keep import for OpenAPI type resolution

import uuid
from datetime import datetime

from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.core.time import utcnow
from app.models.booking import BOOKING_CONFIRMED, Booking
from app.models.profile import Profile
from app.models.resource import Resource
from app.models.slot import Slot
from app.models.waitlist import WL_WAITING, WaitlistEntry
from app.schemas.slots import SlotCreate, SlotOut, SlotUpdate
from app.services import policy
from app.services.audit import record_audit
from app.services.pagination import paginate

EXCLUSION_VIOLATION = "23P01"


def lock_slot(db: Session, slot_id: uuid.UUID) -> Slot:
    """Serialisation point for every mutation of a slot (booking, cancel, waitlist, promote).

    Lock order everywhere: slot row first, then rows that belong to it. This avoids deadlocks.
    """
    slot = db.execute(
        select(Slot)
        .where(Slot.id == slot_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if slot is None:
        raise NotFoundError("Slot not found.", code="slot_not_found")
    return slot


def _projection(user_id: uuid.UUID):
    booked = exists().where(Booking.slot_id == Slot.id, Booking.status == BOOKING_CONFIRMED)
    mine = exists().where(
        Booking.slot_id == Slot.id, Booking.status == BOOKING_CONFIRMED, Booking.user_id == user_id
    )
    waiting = (
        select(func.count(WaitlistEntry.id))
        .where(WaitlistEntry.slot_id == Slot.id, WaitlistEntry.status == WL_WAITING)
        .correlate(Slot)
        .scalar_subquery()
    )
    return select(
        Slot,
        Resource,
        booked.label("is_booked"),
        mine.label("booked_by_me"),
        waiting.label("waitlist_count"),
    ).join(Resource, Resource.id == Slot.resource_id)


def _to_out(row, now: datetime) -> SlotOut:
    slot, resource, is_booked, mine, waiting = row
    return SlotOut(
        id=slot.id,
        resource_id=resource.id,
        resource_name=resource.name,
        resource_location=resource.location,
        resource_category=resource.category,
        resource_active=resource.is_active,
        start_at=slot.start_at,
        end_at=slot.end_at,
        is_available=(not is_booked) and resource.is_active and slot.start_at > now,
        booked_by_me=bool(mine),
        waitlist_count=int(waiting or 0),
    )


def list_slots(
    db: Session,
    user: Profile,
    page: int,
    page_size: int,
    *,
    resource_id: uuid.UUID | None,
    start_from: datetime | None,
    start_to: datetime | None,
    location: str | None,
    category: str | None,
    available_only: bool,
    include_inactive: bool,
):
    now = utcnow()
    stmt = _projection(user.id).where(
        Slot.start_at >= max(start_from, now) if start_from else Slot.start_at >= now
    )
    if not (include_inactive and policy.is_admin(user.role)):
        stmt = stmt.where(Resource.is_active.is_(True))
    if resource_id:
        stmt = stmt.where(Slot.resource_id == resource_id)
    if start_to:
        stmt = stmt.where(Slot.start_at < start_to)
    if location:
        stmt = stmt.where(Resource.location == location)
    if category:
        stmt = stmt.where(Resource.category == category)
    if available_only:
        stmt = stmt.where(
            ~exists().where(Booking.slot_id == Slot.id, Booking.status == BOOKING_CONFIRMED)
        )
    stmt = stmt.order_by(Slot.start_at, Slot.id)
    rows, total = paginate(db, stmt, page, page_size)
    return [_to_out(r, now) for r in rows], total


def get_slot_out(db: Session, user: Profile, slot_id: uuid.UUID) -> SlotOut:
    row = db.execute(_projection(user.id).where(Slot.id == slot_id)).one_or_none()
    if row is None or (not row[1].is_active and not policy.is_admin(user.role)):
        raise NotFoundError("Slot not found.", code="slot_not_found")
    return _to_out(row, utcnow())


def _flush_checking_overlap(db: Session) -> None:
    try:
        db.flush()
    except IntegrityError as exc:
        if getattr(exc.orig, "sqlstate", None) == EXCLUSION_VIOLATION:
            raise ConflictError(
                "This slot overlaps an existing slot for the resource.", code="slot_overlap"
            ) from exc
        raise


def create_slot(db: Session, admin: Profile, resource_id: uuid.UUID, data: SlotCreate) -> uuid.UUID:
    policy.validate_slot_times(data.start_at, data.end_at, utcnow())
    resource = db.execute(
        select(Resource).where(Resource.id == resource_id).with_for_update()
    ).scalar_one_or_none()
    if resource is None:
        raise NotFoundError("Resource not found.", code="resource_not_found")
    if not resource.is_active:
        raise ConflictError("Cannot add slots to an inactive resource.", code="resource_inactive")
    slot = Slot(resource_id=resource_id, start_at=data.start_at, end_at=data.end_at)
    db.add(slot)
    _flush_checking_overlap(db)
    record_audit(db, "slot.created", admin.id, "slot", slot.id, {"resource_id": str(resource_id)})
    return slot.id


def update_slot(db: Session, admin: Profile, slot_id: uuid.UUID, data: SlotUpdate) -> uuid.UUID:
    slot = lock_slot(db, slot_id)
    has_booking = db.execute(
        select(Booking.id).where(Booking.slot_id == slot.id, Booking.status == BOOKING_CONFIRMED)
    ).first()
    if has_booking:
        raise ConflictError(
            "A booked slot cannot be changed; cancel the booking first.", code="slot_has_booking"
        )
    start = data.start_at or slot.start_at
    end = data.end_at or slot.end_at
    policy.validate_slot_times(start, end, utcnow())
    slot.start_at, slot.end_at = start, end
    _flush_checking_overlap(db)
    record_audit(db, "slot.updated", admin.id, "slot", slot.id, {})
    return slot.id

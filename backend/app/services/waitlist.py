import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.core.time import utcnow
from app.models.booking import BOOKING_CONFIRMED, Booking
from app.models.profile import Profile
from app.models.resource import Resource
from app.models.slot import Slot
from app.models.waitlist import WL_CANCELLED, WL_WAITING, WaitlistEntry
from app.schemas.bookings import WaitlistEntryOut
from app.services.audit import record_audit
from app.services.pagination import paginate
from app.services.slots import lock_slot


def _row_to_out(
    entry: WaitlistEntry, slot: Slot, resource: Resource, pos: int | None
) -> WaitlistEntryOut:
    return WaitlistEntryOut(
        id=entry.id,
        slot_id=entry.slot_id,
        status=entry.status,
        position=int(pos) if (pos is not None and entry.status == WL_WAITING) else None,
        created_at=entry.created_at,
        promoted_at=entry.promoted_at,
        cancelled_at=entry.cancelled_at,
        booking_id=entry.booking_id,
        resource_id=resource.id,
        resource_name=resource.name,
        slot_start_at=slot.start_at,
        slot_end_at=slot.end_at,
    )


def _query(user_id: uuid.UUID):
    mine_slots = select(WaitlistEntry.slot_id).where(
        WaitlistEntry.user_id == user_id, WaitlistEntry.status == WL_WAITING
    )
    ranked = (
        select(
            WaitlistEntry.id.label("id"),
            func.row_number()
            .over(
                partition_by=WaitlistEntry.slot_id,
                order_by=(WaitlistEntry.created_at, WaitlistEntry.id),
            )
            .label("pos"),
        )
        .where(WaitlistEntry.status == WL_WAITING, WaitlistEntry.slot_id.in_(mine_slots))
        .subquery()
    )
    return (
        select(WaitlistEntry, Slot, Resource, ranked.c.pos)
        .join(Slot, Slot.id == WaitlistEntry.slot_id)
        .join(Resource, Resource.id == Slot.resource_id)
        .outerjoin(ranked, ranked.c.id == WaitlistEntry.id)
    )


def get_entry_out(db: Session, user: Profile, entry_id: uuid.UUID) -> WaitlistEntryOut:
    row = db.execute(
        _query(user.id).where(WaitlistEntry.id == entry_id, WaitlistEntry.user_id == user.id)
    ).one_or_none()
    if row is None:
        raise NotFoundError("Waitlist entry not found.", code="waitlist_entry_not_found")
    return _row_to_out(*row)


def list_my_entries(db: Session, user: Profile, page: int, page_size: int, active_only: bool):
    stmt = _query(user.id).where(WaitlistEntry.user_id == user.id)
    if active_only:
        stmt = stmt.where(WaitlistEntry.status == WL_WAITING)
    stmt = stmt.order_by(WaitlistEntry.created_at.desc(), WaitlistEntry.id.desc())
    rows, total = paginate(db, stmt, page, page_size)
    return [_row_to_out(*r) for r in rows], total


def join_waitlist(db: Session, user: Profile, slot_id: uuid.UUID) -> uuid.UUID:
    slot = lock_slot(db, slot_id)
    resource = db.get(Resource, slot.resource_id)
    if resource is None or not resource.is_active:
        raise ConflictError("This resource is no longer available.", code="resource_inactive")
    if slot.start_at <= utcnow():
        raise ConflictError("This slot has already started.", code="slot_in_past")
    holder = db.execute(
        select(Booking.user_id).where(
            Booking.slot_id == slot.id, Booking.status == BOOKING_CONFIRMED
        )
    ).scalar_one_or_none()
    if holder is None:
        raise ConflictError(
            "This slot is available; book it directly instead.", code="slot_available"
        )
    if holder == user.id:
        raise ConflictError("You already hold this slot.", code="already_booked")
    entry = WaitlistEntry(slot_id=slot.id, user_id=user.id)
    db.add(entry)
    try:
        db.flush()
    except IntegrityError as exc:  # partial unique index on (slot, user) WHERE waiting
        raise ConflictError(
            "You are already on the waitlist for this slot.", code="already_waiting"
        ) from exc
    record_audit(
        db, "waitlist.joined", user.id, "waitlist_entry", entry.id, {"slot_id": str(slot.id)}
    )
    return entry.id


def leave_waitlist(db: Session, user: Profile, entry_id: uuid.UUID) -> None:
    entry = db.get(WaitlistEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise NotFoundError("Waitlist entry not found.", code="waitlist_entry_not_found")
    lock_slot(db, entry.slot_id)  # serialise with promotion
    db.refresh(entry)
    if entry.status != WL_WAITING:
        raise ConflictError("This waitlist entry is no longer active.", code="waitlist_not_active")
    entry.status, entry.cancelled_at = WL_CANCELLED, utcnow()
    record_audit(
        db, "waitlist.left", user.id, "waitlist_entry", entry.id, {"slot_id": str(entry.slot_id)}
    )

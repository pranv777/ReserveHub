import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.core.time import utcnow
from app.models.booking import (
    BOOKING_CANCELLED,
    BOOKING_CONFIRMED,
    SOURCE_DIRECT,
    SOURCE_WAITLIST,
    Booking,
)
from app.models.profile import Profile
from app.models.resource import Resource
from app.models.slot import Slot
from app.models.waitlist import WL_CANCELLED, WL_EXPIRED, WL_PROMOTED, WL_WAITING, WaitlistEntry
from app.schemas.bookings import AdminBookingOut, BookingOut
from app.services import idempotency, policy
from app.services.audit import notify, record_audit
from app.services.pagination import paginate
from app.services.slots import lock_slot

SCOPE_CREATE = "booking.create"


def _resource_of(db: Session, slot: Slot) -> Resource:
    resource = db.get(Resource, slot.resource_id)
    if resource is None:  # cannot happen (foreign key), but keeps the types honest
        raise NotFoundError("Resource not found.", code="resource_not_found")
    return resource


def booking_out(b: Booking, slot: Slot, resource: Resource) -> BookingOut:
    return BookingOut(
        id=b.id,
        slot_id=b.slot_id,
        user_id=b.user_id,
        status=b.status,
        source=b.source,
        created_at=b.created_at,
        cancelled_at=b.cancelled_at,
        resource_id=resource.id,
        resource_name=resource.name,
        slot_start_at=slot.start_at,
        slot_end_at=slot.end_at,
    )


def _detail(db: Session, booking_id: uuid.UUID) -> BookingOut:
    row = db.execute(
        select(Booking, Slot, Resource)
        .join(Slot, Slot.id == Booking.slot_id)
        .join(Resource, Resource.id == Slot.resource_id)
        .where(Booking.id == booking_id)
    ).one()
    return booking_out(*row)


def _insert_booking(db: Session, slot: Slot, user_id: uuid.UUID, source: str) -> Booking:
    booking = Booking(slot_id=slot.id, user_id=user_id, source=source)
    db.add(booking)
    try:
        db.flush()
    except IntegrityError as exc:  # partial unique index: last line of defence
        raise ConflictError("This slot is no longer available.", code="slot_unavailable") from exc
    return booking


def _confirmed_exists(db: Session, slot_id: uuid.UUID) -> bool:
    return (
        db.execute(
            select(Booking.id).where(
                Booking.slot_id == slot_id, Booking.status == BOOKING_CONFIRMED
            )
        ).first()
        is not None
    )


def create_booking(db: Session, user: Profile, slot_id: uuid.UUID, key: str) -> tuple[int, dict]:
    """One transaction: idempotency claim -> slot lock -> checks -> insert -> side records.

    The caller commits. Any exception leaves nothing behind once the session is rolled back
    (including the idempotency record).
    """
    fingerprint = policy.request_fingerprint({"slot_id": str(slot_id)})
    claim = idempotency.claim(db, user.id, SCOPE_CREATE, key, fingerprint)
    if claim.replay is not None:
        return claim.replay

    slot = lock_slot(db, slot_id)
    resource = db.get(Resource, slot.resource_id)
    now = utcnow()
    if resource is None or not resource.is_active:
        raise ConflictError("This resource is no longer available.", code="resource_inactive")
    if slot.start_at <= now:
        raise ConflictError("This slot has already started.", code="slot_in_past")
    if _confirmed_exists(db, slot.id):
        raise ConflictError("This slot is no longer available.", code="slot_unavailable")

    booking = _insert_booking(db, slot, user.id, SOURCE_DIRECT)
    # A user who booked directly no longer needs their own waiting entry for this slot.
    for entry in db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.slot_id == slot.id,
            WaitlistEntry.user_id == user.id,
            WaitlistEntry.status == WL_WAITING,
        )
    ).scalars():
        entry.status, entry.cancelled_at = WL_CANCELLED, now
    notify(
        db,
        user.id,
        "booking_confirmed",
        f"Your booking for {resource.name} is confirmed.",
        slot.id,
        booking.id,
    )
    record_audit(db, "booking.created", user.id, "booking", booking.id, {"slot_id": str(slot.id)})
    body = booking_out(booking, slot, resource).model_dump(mode="json")
    idempotency.complete(db, claim.record_id, 201, body)
    return 201, body


def get_booking(db: Session, user: Profile, booking_id: uuid.UUID) -> BookingOut:
    owner = db.execute(select(Booking.user_id).where(Booking.id == booking_id)).scalar_one_or_none()
    # Policy: someone else's booking is indistinguishable from a missing one (404).
    if owner is None or not policy.owns(user.id, owner):
        raise NotFoundError("Booking not found.", code="booking_not_found")
    return _detail(db, booking_id)


def list_my_bookings(db: Session, user: Profile, page: int, page_size: int, when: str):
    now = utcnow()
    stmt = (
        select(Booking, Slot, Resource)
        .join(Slot, Slot.id == Booking.slot_id)
        .join(Resource, Resource.id == Slot.resource_id)
        .where(Booking.user_id == user.id)
    )
    if when == "upcoming":
        stmt = stmt.where(Booking.status == BOOKING_CONFIRMED, Slot.start_at > now)
        stmt = stmt.order_by(Slot.start_at, Booking.id)
    else:
        if when == "past":
            stmt = stmt.where((Booking.status != BOOKING_CONFIRMED) | (Slot.start_at <= now))
        stmt = stmt.order_by(Booking.created_at.desc(), Booking.id.desc())
    rows, total = paginate(db, stmt, page, page_size)
    return [booking_out(*r) for r in rows], total


def promote_next(db: Session, slot: Slot, now: datetime) -> Booking | None:
    """Caller MUST hold the slot lock. Promotes the oldest eligible waiting entry."""
    entries = (
        db.execute(
            select(WaitlistEntry)
            .where(WaitlistEntry.slot_id == slot.id, WaitlistEntry.status == WL_WAITING)
            .order_by(WaitlistEntry.created_at, WaitlistEntry.id)
            .with_for_update()
        )
        .scalars()
        .all()
    )
    if not entries:
        return None
    profiles = {
        p.id: p
        for p in db.execute(
            select(Profile).where(Profile.id.in_([e.user_id for e in entries]))
        ).scalars()
    }
    candidates = [
        policy.WaitlistCandidate(
            id=e.id,
            created_at=e.created_at,
            status=e.status,
            user_active=bool(profiles.get(e.user_id) and profiles[e.user_id].is_active),
        )
        for e in entries
    ]
    chosen, skipped = policy.pick_next_waitlist(candidates, slot.start_at, now)
    by_id = {e.id: e for e in entries}
    for c in skipped:  # ineligible entries are retired, never promoted
        by_id[c.id].status, by_id[c.id].cancelled_at = WL_EXPIRED, now
    if chosen is None:
        return None
    entry = by_id[chosen.id]
    booking = _insert_booking(db, slot, entry.user_id, SOURCE_WAITLIST)
    entry.status, entry.promoted_at, entry.booking_id = WL_PROMOTED, now, booking.id
    resource = _resource_of(db, slot)
    notify(
        db,
        entry.user_id,
        "waitlist_promoted",
        f"A spot opened up: you now have a confirmed booking for {resource.name}.",
        slot.id,
        booking.id,
    )
    record_audit(
        db,
        "waitlist.promoted",
        None,
        "booking",
        booking.id,
        {"slot_id": str(slot.id), "waitlist_entry_id": str(entry.id)},
    )
    return booking


def cancel_booking(db: Session, user: Profile, booking_id: uuid.UUID) -> BookingOut:
    """Cancel + promote in ONE transaction under the slot lock. Caller commits."""
    booking = db.get(Booking, booking_id)
    if booking is None or not policy.owns(user.id, booking.user_id):
        raise NotFoundError("Booking not found.", code="booking_not_found")
    slot = lock_slot(db, booking.slot_id)
    db.refresh(booking)  # re-read under the lock: a concurrent cancel may have won
    policy.assert_transition(booking.status, BOOKING_CANCELLED)
    now = utcnow()
    policy.assert_cancellable(slot.start_at, now)
    booking.status, booking.cancelled_at = BOOKING_CANCELLED, now
    db.flush()
    resource = _resource_of(db, slot)
    notify(
        db,
        user.id,
        "booking_cancelled",
        f"Your booking for {resource.name} was cancelled.",
        slot.id,
        booking.id,
    )
    record_audit(db, "booking.cancelled", user.id, "booking", booking.id, {"slot_id": str(slot.id)})
    promote_next(db, slot, now)
    return _detail(db, booking.id)


def list_admin_bookings(
    db: Session,
    page: int,
    page_size: int,
    *,
    resource_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    status: str | None,
    start_from: datetime | None,
    start_to: datetime | None,
):
    stmt = (
        select(Booking, Slot, Resource, Profile.email)
        .join(Slot, Slot.id == Booking.slot_id)
        .join(Resource, Resource.id == Slot.resource_id)
        .join(Profile, Profile.id == Booking.user_id)
    )
    if resource_id:
        stmt = stmt.where(Resource.id == resource_id)
    if user_id:
        stmt = stmt.where(Booking.user_id == user_id)
    if status:
        stmt = stmt.where(Booking.status == status)
    if start_from:
        stmt = stmt.where(Slot.start_at >= start_from)
    if start_to:
        stmt = stmt.where(Slot.start_at < start_to)
    stmt = stmt.order_by(Booking.created_at.desc(), Booking.id.desc())
    rows, total = paginate(db, stmt, page, page_size)
    items = [
        AdminBookingOut(**booking_out(b, s, r).model_dump(), user_email=email)
        for b, s, r, email in rows
    ]
    return items, total

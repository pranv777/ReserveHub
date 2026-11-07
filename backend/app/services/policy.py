"""Pure business rules (no database access) so they can be unit tested."""

import hashlib
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.errors import BadRequestError, ConflictError
from app.models.booking import BOOKING_CANCELLED, BOOKING_CONFIRMED
from app.models.profile import ROLE_ADMIN
from app.models.waitlist import WL_WAITING

MAX_SLOT_DURATION = timedelta(hours=24)

# Booking state machine: confirmed -> cancelled. Cancelled is terminal.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    BOOKING_CONFIRMED: {BOOKING_CANCELLED},
    BOOKING_CANCELLED: set(),
}


def validate_slot_times(start: datetime, end: datetime, now: datetime) -> None:
    if end <= start:
        raise BadRequestError("End time must be after start time.", code="invalid_time_range")
    if start <= now:
        raise BadRequestError("A slot must start in the future.", code="slot_in_past")
    if end - start > MAX_SLOT_DURATION:
        raise BadRequestError("A slot may not be longer than 24 hours.", code="slot_too_long")


def intervals_overlap(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    """Half-open intervals [start, end): back-to-back slots do not overlap."""
    return a_start < b_end and b_start < a_end


def assert_transition(current: str, target: str) -> None:
    if target not in ALLOWED_TRANSITIONS.get(current, set()):
        raise ConflictError(
            f"A {current} booking cannot become {target}.", code="invalid_state_transition"
        )


def assert_cancellable(slot_start: datetime, now: datetime) -> None:
    """Cancellation policy: allowed any time until the slot starts."""
    if slot_start <= now:
        raise ConflictError(
            "Bookings cannot be cancelled after the slot has started.",
            code="cancellation_window_closed",
        )


def is_admin(role: str) -> bool:
    return role == ROLE_ADMIN


def owns(user_id: UUID, owner_id: UUID) -> bool:
    return user_id == owner_id


@dataclass(frozen=True)
class WaitlistCandidate:
    id: UUID
    created_at: datetime
    status: str
    user_active: bool


def waitlist_entry_eligible(c: WaitlistCandidate, slot_start: datetime, now: datetime) -> bool:
    return c.status == WL_WAITING and c.user_active and slot_start > now


def pick_next_waitlist(
    candidates: Sequence[WaitlistCandidate], slot_start: datetime, now: datetime
) -> tuple[WaitlistCandidate | None, list[WaitlistCandidate]]:
    """FIFO by (created_at, id). Returns (chosen, ineligible entries passed over before it)."""
    skipped: list[WaitlistCandidate] = []
    for c in sorted(candidates, key=lambda x: (x.created_at, str(x.id))):
        if c.status != WL_WAITING:
            continue
        if waitlist_entry_eligible(c, slot_start, now):
            return c, skipped
        skipped.append(c)
    return None, skipped


def request_fingerprint(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()

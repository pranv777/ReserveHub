import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class BookingCreate(BaseModel):
    slot_id: uuid.UUID


class BookingOut(BaseModel):
    id: uuid.UUID
    slot_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    source: str
    created_at: datetime
    cancelled_at: datetime | None
    resource_id: uuid.UUID
    resource_name: str
    slot_start_at: datetime
    slot_end_at: datetime


class AdminBookingOut(BookingOut):
    user_email: str | None = None


class WaitlistEntryOut(BaseModel):
    id: uuid.UUID
    slot_id: uuid.UUID
    status: str
    position: int | None
    created_at: datetime
    promoted_at: datetime | None
    cancelled_at: datetime | None
    booking_id: uuid.UUID | None
    resource_id: uuid.UUID
    resource_name: str
    slot_start_at: datetime
    slot_end_at: datetime


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    message: str
    slot_id: uuid.UUID | None
    booking_id: uuid.UUID | None
    read_at: datetime | None
    created_at: datetime


class AuditEventOut(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    target_type: str
    target_id: uuid.UUID | None
    metadata: dict[str, Any]
    created_at: datetime


class MeOut(BaseModel):
    id: uuid.UUID
    email: str | None
    display_name: str | None
    role: str

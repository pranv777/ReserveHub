import uuid
from datetime import datetime

from pydantic import AwareDatetime, BaseModel


class SlotCreate(BaseModel):
    start_at: AwareDatetime
    end_at: AwareDatetime


class SlotUpdate(BaseModel):
    start_at: AwareDatetime | None = None
    end_at: AwareDatetime | None = None


class SlotOut(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    resource_name: str
    resource_location: str
    resource_category: str
    resource_active: bool
    start_at: datetime
    end_at: datetime
    # Derived from authoritative DB state on every request (no stored boolean).
    is_available: bool
    booked_by_me: bool
    waitlist_count: int

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

BOOKING_CONFIRMED = "confirmed"
BOOKING_CANCELLED = "cancelled"
SOURCE_DIRECT = "direct"
SOURCE_WAITLIST = "waitlist"


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("status IN ('confirmed','cancelled')", name="status_valid"),
        CheckConstraint("source IN ('direct','waitlist')", name="source_valid"),
        CheckConstraint(
            "(status = 'cancelled') = (cancelled_at IS NOT NULL)", name="cancel_ts_consistent"
        ),
        # Final line of defence against double booking: one confirmed booking per slot.
        Index(
            "uix_bookings_one_confirmed_per_slot",
            "slot_id",
            unique=True,
            postgresql_where=text("status = 'confirmed'"),
        ),
        Index("ix_bookings_user_history", "user_id", "created_at", "id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("availability_slots.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"))
    status: Mapped[str] = mapped_column(String(16), server_default=BOOKING_CONFIRMED)
    source: Mapped[str] = mapped_column(String(16), server_default=SOURCE_DIRECT)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

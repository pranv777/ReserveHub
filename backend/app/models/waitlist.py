import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

WL_WAITING = "waiting"
WL_PROMOTED = "promoted"
WL_CANCELLED = "cancelled"
WL_EXPIRED = "expired"


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"
    __table_args__ = (
        CheckConstraint(
            "status IN ('waiting','promoted','cancelled','expired')", name="status_valid"
        ),
        Index(
            "uix_waitlist_one_waiting_per_user_slot",
            "slot_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'waiting'"),
        ),
        Index(
            "ix_waitlist_fifo",
            "slot_id",
            "created_at",
            "id",
            postgresql_where=text("status = 'waiting'"),
        ),
        Index("ix_waitlist_user", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("availability_slots.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"))
    status: Mapped[str] = mapped_column(String(16), server_default=WL_WAITING)
    # clock_timestamp() (not now()) so FIFO order follows real insertion order, not txn start.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("clock_timestamp()")
    )
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    booking_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bookings.id"))

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Slot(Base):
    """A bookable time window. No 'is_booked' column: availability is derived from bookings.

    Overlap prevention for one resource is a PostgreSQL EXCLUDE constraint (see migration
    0001, constraint ``ex_slots_no_overlap``).
    """

    __tablename__ = "availability_slots"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="end_after_start"),
        Index("ix_slots_resource_start", "resource_id", "start_at"),
        Index("ix_slots_start", "start_at", "id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resources.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

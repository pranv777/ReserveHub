import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = (
        CheckConstraint("capacity >= 1", name="capacity_positive"),
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        Index("ix_resources_active_name", "is_active", "name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(2000), server_default="")
    location: Mapped[str] = mapped_column(String(120), server_default="")
    category: Mapped[str] = mapped_column(String(60), server_default="")
    # Informational (people the resource fits). Booking model is single-booking-per-slot.
    capacity: Mapped[int] = mapped_column(Integer, server_default="1")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

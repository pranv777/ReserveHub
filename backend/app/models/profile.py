import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

ROLE_MEMBER = "member"
ROLE_ADMIN = "admin"


class Profile(Base):
    """Application profile keyed by the Auth provider's immutable user id."""

    __tablename__ = "profiles"
    __table_args__ = (CheckConstraint("role IN ('member','admin')", name="role_valid"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320))
    display_name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(16), server_default=ROLE_MEMBER)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

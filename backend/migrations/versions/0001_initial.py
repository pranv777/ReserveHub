"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-21
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

UUID = pg.UUID(as_uuid=True)
GEN = sa.text("gen_random_uuid()")
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    # Needed for the EXCLUDE constraint mixing uuid equality with range overlap.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "profiles",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("email", sa.String(320)),
        sa.Column("display_name", sa.String(120)),
        sa.Column("role", sa.String(16), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('member','admin')", name="ck_profiles_role_valid"),
    )

    op.create_table(
        "resources",
        sa.Column("id", UUID, primary_key=True, server_default=GEN),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(2000), nullable=False, server_default=""),
        sa.Column("location", sa.String(120), nullable=False, server_default=""),
        sa.Column("category", sa.String(60), nullable=False, server_default=""),
        sa.Column("capacity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("capacity >= 1", name="ck_resources_capacity_positive"),
        sa.CheckConstraint("length(btrim(name)) > 0", name="ck_resources_name_not_blank"),
    )
    op.create_index("ix_resources_active_name", "resources", ["is_active", "name"])

    op.create_table(
        "availability_slots",
        sa.Column("id", UUID, primary_key=True, server_default=GEN),
        sa.Column("resource_id", UUID, sa.ForeignKey("resources.id"), nullable=False),
        sa.Column("start_at", TS, nullable=False),
        sa.Column("end_at", TS, nullable=False),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("end_at > start_at", name="ck_availability_slots_end_after_start"),
    )
    op.create_index("ix_slots_resource_start", "availability_slots", ["resource_id", "start_at"])
    op.create_index("ix_slots_start", "availability_slots", ["start_at", "id"])
    # No two slots of the same resource may overlap (half-open ranges: back-to-back is fine).
    op.execute(
        "ALTER TABLE availability_slots ADD CONSTRAINT ex_slots_no_overlap "
        "EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)"
    )

    op.create_table(
        "bookings",
        sa.Column("id", UUID, primary_key=True, server_default=GEN),
        sa.Column("slot_id", UUID, sa.ForeignKey("availability_slots.id"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="confirmed"),
        sa.Column("source", sa.String(16), nullable=False, server_default="direct"),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("cancelled_at", TS),
        sa.CheckConstraint("status IN ('confirmed','cancelled')", name="ck_bookings_status_valid"),
        sa.CheckConstraint("source IN ('direct','waitlist')", name="ck_bookings_source_valid"),
        sa.CheckConstraint(
            "(status = 'cancelled') = (cancelled_at IS NOT NULL)",
            name="ck_bookings_cancel_ts_consistent",
        ),
    )
    op.create_index(
        "uix_bookings_one_confirmed_per_slot",
        "bookings",
        ["slot_id"],
        unique=True,
        postgresql_where=sa.text("status = 'confirmed'"),
    )
    op.create_index("ix_bookings_user_history", "bookings", ["user_id", "created_at", "id"])
    op.create_index("ix_bookings_slot", "bookings", ["slot_id"])

    op.create_table(
        "waitlist_entries",
        sa.Column("id", UUID, primary_key=True, server_default=GEN),
        sa.Column("slot_id", UUID, sa.ForeignKey("availability_slots.id"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="waiting"),
        sa.Column("created_at", TS, nullable=False, server_default=sa.text("clock_timestamp()")),
        sa.Column("promoted_at", TS),
        sa.Column("cancelled_at", TS),
        sa.Column("booking_id", UUID, sa.ForeignKey("bookings.id")),
        sa.CheckConstraint(
            "status IN ('waiting','promoted','cancelled','expired')",
            name="ck_waitlist_entries_status_valid",
        ),
    )
    op.create_index(
        "uix_waitlist_one_waiting_per_user_slot",
        "waitlist_entries",
        ["slot_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'waiting'"),
    )
    op.create_index(
        "ix_waitlist_fifo",
        "waitlist_entries",
        ["slot_id", "created_at", "id"],
        postgresql_where=sa.text("status = 'waiting'"),
    )
    op.create_index("ix_waitlist_user", "waitlist_entries", ["user_id", "created_at"])

    op.create_table(
        "idempotency_records",
        sa.Column("id", UUID, primary_key=True, server_default=GEN),
        sa.Column("user_id", UUID, sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("scope", sa.String(64), nullable=False),
        sa.Column("key", sa.String(128), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("response_status", sa.Integer),
        sa.Column("response_body", pg.JSONB),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "scope", "key", name="uq_idempotency_user_scope_key"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", UUID, primary_key=True, server_default=GEN),
        sa.Column("user_id", UUID, sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("message", sa.String(255), nullable=False),
        sa.Column("slot_id", UUID, sa.ForeignKey("availability_slots.id")),
        sa.Column("booking_id", UUID, sa.ForeignKey("bookings.id")),
        sa.Column("read_at", TS),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_notifications_user_created", "notifications", ["user_id", "created_at", "id"]
    )

    op.create_table(
        "audit_events",
        sa.Column("id", UUID, primary_key=True, server_default=GEN),
        sa.Column("actor_id", UUID, sa.ForeignKey("profiles.id", ondelete="SET NULL")),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("target_type", sa.String(40), nullable=False),
        sa.Column("target_id", UUID),
        sa.Column("metadata", pg.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_created", "audit_events", ["created_at", "id"])
    op.create_index("ix_audit_type_created", "audit_events", ["event_type", "created_at"])
    op.create_index("ix_audit_actor_created", "audit_events", ["actor_id", "created_at"])


def downgrade() -> None:
    for table in (
        "audit_events",
        "notifications",
        "idempotency_records",
        "waitlist_entries",
        "bookings",
        "availability_slots",
        "resources",
        "profiles",
    ):
        op.drop_table(table)

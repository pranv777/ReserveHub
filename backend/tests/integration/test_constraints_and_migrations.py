import uuid
from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from tests.helpers import create_resource, create_slot, create_user


def run(db, sql, **params):
    db.execute(text(sql), params)
    db.flush()


def test_only_one_confirmed_booking_per_slot(db):
    a, b = create_user(), create_user()
    slot = create_slot(create_resource())
    ins = "INSERT INTO bookings (slot_id, user_id) VALUES (:s, :u)"
    run(db, ins, s=slot.id, u=a.id)
    with pytest.raises(IntegrityError):
        run(db, ins, s=slot.id, u=b.id)


def test_cancelled_booking_does_not_block_new_confirmed(db):
    a, b = create_user(), create_user()
    slot = create_slot(create_resource())
    run(
        db,
        "INSERT INTO bookings "
        "(slot_id,user_id,status,cancelled_at) "
        "VALUES (:s,:u,'cancelled',now())",
        s=slot.id,
        u=a.id,
    )
    run(db, "INSERT INTO bookings (slot_id,user_id) VALUES (:s,:u)", s=slot.id, u=b.id)


def test_duplicate_active_waitlist_entry_rejected(db):
    a = create_user()
    slot = create_slot(create_resource())
    ins = "INSERT INTO waitlist_entries (slot_id, user_id) VALUES (:s, :u)"
    run(db, ins, s=slot.id, u=a.id)
    with pytest.raises(IntegrityError):
        run(db, ins, s=slot.id, u=a.id)


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO bookings (slot_id,user_id,status) VALUES (:s,:u,'weird')",
        "INSERT INTO bookings (slot_id,user_id,status) VALUES (:s,:u,'cancelled')",
        "INSERT INTO bookings (slot_id,user_id,source) VALUES (:s,:u,'other')",
        "INSERT INTO waitlist_entries (slot_id,user_id,status) VALUES (:s,:u,'weird')",
    ],
)
def test_check_constraints(db, sql):
    u = create_user()
    slot = create_slot(create_resource())
    with pytest.raises(IntegrityError):
        run(db, sql, s=slot.id, u=u.id)


def test_slot_constraints(db):
    res = create_resource()
    t = datetime.now(UTC) + timedelta(days=3)
    ins = "INSERT INTO availability_slots (resource_id,start_at,end_at) VALUES (:r,:s,:e)"
    with pytest.raises(IntegrityError):  # end must be after start
        run(db, ins, r=res.id, s=t, e=t)
    db.rollback()
    run(db, ins, r=res.id, s=t, e=t + timedelta(hours=2))
    with pytest.raises(IntegrityError):  # overlap rejected by EXCLUDE constraint
        run(db, ins, r=res.id, s=t + timedelta(hours=1), e=t + timedelta(hours=3))
    db.rollback()
    other = create_resource("Other")
    run(db, ins, r=other.id, s=t, e=t + timedelta(hours=2))  # other resource may overlap


def test_resource_and_profile_constraints(db):
    with pytest.raises(IntegrityError):
        run(db, "INSERT INTO resources (name, capacity) VALUES ('x', 0)")
    db.rollback()
    with pytest.raises(IntegrityError):
        run(db, "INSERT INTO resources (name) VALUES ('   ')")
    db.rollback()
    with pytest.raises(IntegrityError):
        run(db, "INSERT INTO profiles (id, role) VALUES (:i, 'superuser')", i=uuid.uuid4())


def test_foreign_keys_enforced(db):
    with pytest.raises(IntegrityError):
        run(
            db,
            "INSERT INTO bookings (slot_id,user_id) VALUES (:s,:u)",
            s=uuid.uuid4(),
            u=uuid.uuid4(),
        )


def test_migrations_apply_clean_and_roundtrip(migrated_db):
    command.downgrade(migrated_db, "base")
    command.upgrade(migrated_db, "head")


def test_row_level_security_enabled_on_every_public_table(db):
    unprotected = (
        db.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity")
        )
        .scalars()
        .all()
    )
    assert unprotected == []  # includes alembic_version

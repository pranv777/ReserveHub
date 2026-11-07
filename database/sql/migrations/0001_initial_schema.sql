-- ReserveHub initial schema (PostgreSQL 15+, Supabase compatible).
-- Mirrors backend/migrations/versions/0001_initial.py exactly and stamps alembic_version = '0001'
-- so `alembic upgrade head` can take over for later revisions. Idempotent guard: refuses to run twice.
-- Apply with scripts/migrate_sql.sh or paste into the Supabase SQL editor.
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'ReserveHub schema already exists; refusing to run 0001 again';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  email varchar(320),
  display_name varchar(120),
  role varchar(16) NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_profiles_role_valid CHECK (role IN ('member','admin'))
);

CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  description varchar(2000) NOT NULL DEFAULT '',
  location varchar(120) NOT NULL DEFAULT '',
  category varchar(60) NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_resources_capacity_positive CHECK (capacity >= 1),
  CONSTRAINT ck_resources_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE INDEX ix_resources_active_name ON resources (is_active, name);

CREATE TABLE availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resources(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_availability_slots_end_after_start CHECK (end_at > start_at)
);
CREATE INDEX ix_slots_resource_start ON availability_slots (resource_id, start_at);
CREATE INDEX ix_slots_start ON availability_slots (start_at, id);
ALTER TABLE availability_slots ADD CONSTRAINT ex_slots_no_overlap
  EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES availability_slots(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  status varchar(16) NOT NULL DEFAULT 'confirmed',
  source varchar(16) NOT NULL DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT ck_bookings_status_valid CHECK (status IN ('confirmed','cancelled')),
  CONSTRAINT ck_bookings_source_valid CHECK (source IN ('direct','waitlist')),
  CONSTRAINT ck_bookings_cancel_ts_consistent CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE UNIQUE INDEX uix_bookings_one_confirmed_per_slot ON bookings (slot_id) WHERE status = 'confirmed';
CREATE INDEX ix_bookings_user_history ON bookings (user_id, created_at, id);
CREATE INDEX ix_bookings_slot ON bookings (slot_id);

CREATE TABLE waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES availability_slots(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  status varchar(16) NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  promoted_at timestamptz,
  cancelled_at timestamptz,
  booking_id uuid REFERENCES bookings(id),
  CONSTRAINT ck_waitlist_entries_status_valid CHECK (status IN ('waiting','promoted','cancelled','expired'))
);
CREATE UNIQUE INDEX uix_waitlist_one_waiting_per_user_slot ON waitlist_entries (slot_id, user_id) WHERE status = 'waiting';
CREATE INDEX ix_waitlist_fifo ON waitlist_entries (slot_id, created_at, id) WHERE status = 'waiting';
CREATE INDEX ix_waitlist_user ON waitlist_entries (user_id, created_at);

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  scope varchar(64) NOT NULL,
  key varchar(128) NOT NULL,
  request_fingerprint varchar(64) NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_idempotency_user_scope_key UNIQUE (user_id, scope, key)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  type varchar(40) NOT NULL,
  message varchar(255) NOT NULL,
  slot_id uuid REFERENCES availability_slots(id),
  booking_id uuid REFERENCES bookings(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user_created ON notifications (user_id, created_at, id);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type varchar(60) NOT NULL,
  target_type varchar(40) NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_created ON audit_events (created_at, id);
CREATE INDEX ix_audit_type_created ON audit_events (event_type, created_at);
CREATE INDEX ix_audit_actor_created ON audit_events (actor_id, created_at);

-- Alembic bookkeeping (same shape Alembic creates), so later `alembic upgrade head` starts from 0001.
CREATE TABLE IF NOT EXISTS alembic_version (
  version_num varchar(32) NOT NULL,
  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num) VALUES ('0001');

COMMIT;

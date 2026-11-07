-- DESTRUCTIVE: drops every ReserveHub table and all data. Back up first (Supabase: Database > Backups).

BEGIN;
DROP TABLE IF EXISTS audit_events, notifications, idempotency_records, waitlist_entries,
  bookings, availability_slots, resources, profiles CASCADE;
DROP TABLE IF EXISTS alembic_version;
COMMIT;

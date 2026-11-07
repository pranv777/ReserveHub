-- Reverts 0002 (disables RLS; revoked grants are not restored).
BEGIN;
ALTER TABLE profiles            DISABLE ROW LEVEL SECURITY;
ALTER TABLE resources           DISABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots  DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            DISABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries    DISABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events        DISABLE ROW LEVEL SECURITY;
ALTER TABLE alembic_version     DISABLE ROW LEVEL SECURITY;
UPDATE alembic_version SET version_num = '0001';
COMMIT;

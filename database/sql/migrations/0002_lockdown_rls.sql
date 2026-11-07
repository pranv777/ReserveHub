-- Lock down direct table access (see backend/migrations/versions/0002_lockdown_rls.py).
-- Enables row-level security with no policies and revokes anon/authenticated grants.
-- The API connects as the table owner, which bypasses RLS. Requires 0001 applied.
BEGIN;

DO $$
DECLARE v text;
BEGIN
  IF to_regclass('public.alembic_version') IS NULL THEN
    RAISE EXCEPTION 'Expected schema version 0001 before applying 0002 (no alembic_version table: run 0001 first)';
  END IF;
  EXECUTE 'SELECT version_num FROM public.alembic_version LIMIT 1' INTO v;
  IF v IS DISTINCT FROM '0001' THEN
    RAISE EXCEPTION 'Expected schema version 0001 before applying 0002, found %', COALESCE(v, 'none');
  END IF;
END $$;

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources           ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alembic_version     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;

UPDATE alembic_version SET version_num = '0002';
COMMIT;

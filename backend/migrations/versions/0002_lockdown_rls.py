"""lock down direct table access (row-level security)

Supabase (and similar platforms) can expose the `public` schema through an auto-generated REST
API reachable with the public anon key. ReserveHub's only intended entry point is the FastAPI
service, which connects as the table owner (owners bypass RLS). Enabling RLS with NO policies
makes every table invisible to the anon/authenticated roles, and the REVOKEs remove their grants.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-23
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = (
    "profiles",
    "resources",
    "availability_slots",
    "bookings",
    "waitlist_entries",
    "idempotency_records",
    "notifications",
    "audit_events",
    "alembic_version",
)

REVOKE = """
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
"""


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
    op.execute(REVOKE)


def downgrade() -> None:
    # Grants removed above are NOT restored (they were never intended).
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")

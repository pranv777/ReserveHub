# SQL migrations (no Python needed)

| File | Purpose |
|---|---|
| `migrations/0001_initial_schema.sql` | Full schema; equals Alembic revision `0001`; stamps `alembic_version`. |
| `migrations/0002_lockdown_rls.sql` | Row-level security on every table + revokes `anon`/`authenticated` grants (equals Alembic `0002`). |
| `migrations/*.down.sql` | Rollbacks (0001's is destructive). |
| `seed_admin.sql` | Promote a user to admin by email. |

Apply with `scripts/migrate_sql.sh` (psql) **or** paste the files, in order, into the Supabase SQL editor
**or** run `alembic upgrade head`. Use ONE method per database: all leave `alembic_version` at `0002`.
Add a matching `.sql` file whenever you add an Alembic revision, and enable RLS on every new table.

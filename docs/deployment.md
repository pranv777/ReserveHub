# Deployment: Supabase (auth + database) · Render (API) · Vercel (frontend)

> These steps have not been executed by the author of the files; verify with the checklist at the end.
> Provider UIs and free-tier limits change, so check each provider's current docs.

## 1. Supabase (one project = auth + PostgreSQL)
1. Create a project; save the **database password**.
2. Authentication → URL Configuration: Site URL = your Vercel URL (add it after step 4; add `http://localhost:5173` too).
3. Collect: Project URL, anon key, JWKS URL `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`,
   issuer `https://<ref>.supabase.co/auth/v1`.
4. Dashboard → **Connect**: copy a **Session pooler** string (IPv4-friendly, port 5432) for migrations and the API.
   Direct connections may be IPv6-only and unreachable from Render; the **Transaction pooler** (port 6543) also works for
   the API (the app disables prepared statements) but use session/direct for migrations.
5. Apply the schema (pick ONE):
   ```bash
   # A) psql
   DATABASE_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres' scripts/migrate_sql.sh
   # B) Alembic
   cd backend && DATABASE_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres' alembic upgrade head
   # C) Supabase SQL editor: paste database/sql/migrations/0001_initial_schema.sql, run, then 0002_lockdown_rls.sql
   ```
   Migration `0002` turns on row-level security on every table (no policies) and revokes `anon`/`authenticated`
   grants, so the public anon key cannot read or write your tables through Supabase's REST API. Check Dashboard →
   Table Editor shows RLS enabled on each table.
6. Rollback: `database/sql/migrations/*.down.sql` (0001's drops all data) — prefer Supabase backups.

## 2. Render (API)
1. New → Blueprint → select the repo (uses `render.yaml`), or New → Web Service → Docker with root `backend`.
2. Environment variables (secrets are entered in the dashboard):
   | Var | Value |
   |---|---|
   | `DATABASE_URL` | Supabase pooler string from step 1.4 (`postgresql://postgres.<ref>:<password>@<host>:<port>/postgres`) |
   | `CORS_ORIGINS` | your Vercel URL(s), comma separated, exact origin, no trailing slash, no `*` |
   | `SUPABASE_JWKS_URL` | JWKS URL (leave `SUPABASE_JWT_SECRET` unset) |
   | `JWT_ISSUER` | `https://<ref>.supabase.co/auth/v1` |
3. Health check `/api/v1/health/live`; readiness `/api/v1/health/ready` checks the database.
4. Free instances sleep when idle, so the first request after a pause is slow. Render terminates HTTPS.

## 3. Vercel (frontend)
1. Import the repo; **Root Directory = `frontend`** (`vercel.json` provides the SPA rewrite).
2. Environment variables (public by design): `VITE_API_BASE_URL` = Render URL (no trailing slash),
   `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy, then add the Vercel URL to Supabase (Site URL / redirect URLs) and to Render `CORS_ORIGINS`.
   Preview deployments have other origins; add them to `CORS_ORIGINS` only if you need them.

## 4. First admin
Sign up on the deployed site and open it once (creates your `profiles` row), then:
```bash
psql "$DATABASE_URL" -v email='you@example.com' -f database/sql/seed_admin.sql
```
(or run the `UPDATE profiles SET role='admin' WHERE email='…'` statement in the Supabase SQL editor).

## 5. Checklist (verify, then tick)
- [ ] `GET <render-url>/api/v1/health/ready` → 200
- [ ] Sign up/in on the Vercel URL works, no CORS errors in the console
- [ ] Book → cancel; second user joins waitlist → promoted after the first cancels
- [ ] Member sees "Not authorised" on `/admin/*`; admin can create a resource and slot
- [ ] Table Editor shows RLS enabled on all tables; `curl <supabase-url>/rest/v1/profiles -H "apikey: <anon>"` returns an error or empty result, never rows
- [ ] No secrets in git; service-role key is not used anywhere
- [ ] Add rate limiting in front of the API (not implemented in-app)

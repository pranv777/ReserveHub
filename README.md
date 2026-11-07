# ReserveHub — Resource Booking & Waitlist

Members browse resources and time slots, book, cancel, and join a FIFO waitlist. Admins manage
resources and slots. When a confirmed booking is cancelled, the oldest eligible waitlist entry is
promoted in the same database transaction. The focus is **correctness under concurrency**:
double-booking is prevented by row locks plus database constraints, and booking is idempotent.

> **Status (honest summary):** all code, migrations, tests, Docker/CI config and docs are written.
> In the environment where this was generated, package registries were unreachable, so the Python,
> Vitest, Playwright and Docker suites have **not been executed yet**; only the SQL constraints were
> verified against PostgreSQL 16 (see `docs/testing-and-evaluation.md`). Nothing here is deployed.
> Run the commands below to verify on your machine before relying on any claim.

## Stack
React + TypeScript + Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind ·
FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, PyJWT · Supabase (Auth + PostgreSQL) · Pytest/HTTPX, Vitest/RTL, Playwright · Docker, GitHub Actions · Deploy: Vercel (frontend), Render (API), Supabase (auth + DB).

## Architecture
```
Browser (React) --Supabase JS--> Supabase Auth (identity, JWT)
   |  Authorization: Bearer <JWT>
   v
FastAPI  (verifies JWT, loads role from profiles, enforces ownership)
   |  SQLAlchemy (one transaction per request, explicit commit)
   v
PostgreSQL on Supabase (source of truth: constraints, locks, idempotency, audit; RLS blocks direct REST access)
```
Details: `docs/architecture.md`, `docs/database-design.md`, `docs/api-and-errors.md`, `docs/decisions/`.

## Roles
`member` (default for every new account) and `admin`. Roles live only in the `profiles` table and are
never read from token claims or sign-up input. Promote an admin with SQL:
`UPDATE profiles SET role='admin' WHERE email='you@example.com';` or `database/sql/seed_admin.sql` (the profile row is created on first API call).

## Run locally (recommended: local Supabase)

`npx supabase start` runs Supabase Auth **and** PostgreSQL in Docker, so you need no cloud account for development.
Prerequisites: Docker running, Node 22, Python 3.11+.

```bash
# 1. Start Supabase (once per machine/project)
npx supabase init                 # first time only; creates supabase/config.toml
npx supabase start
npx supabase status               # shows API URL, DB URL, anon key, JWT secret

# 2. Backend  (terminal 2)
cd backend && python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env              # set SUPABASE_JWT_SECRET from `status` (or the JWKS URL if keys are asymmetric)
alembic upgrade head              # creates tables + row-level security
uvicorn app.main:app --reload     # http://localhost:8000/docs  (health: /api/v1/health/ready)

# 3. Frontend (terminal 3)
cd frontend && cp .env.example .env     # paste the anon key from `status`
npm install && npm run dev              # http://localhost:5173
```
Sign-up emails (if confirmation is on) are caught by the local inbox URL printed by `status` (usually http://127.0.0.1:54324).

**Make yourself admin:** sign up, open the app once, then
`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v email='you@example.com' -f database/sql/seed_admin.sql`.

### Run in Docker (optional, to test the images before deploying)
```bash
docker compose up --build         # plain Postgres + migrate + api (:8000) + frontend (:5173)
docker compose down -v            # stop and wipe the dev database
```
This still needs Supabase **Auth** values in the root `.env` (use a free cloud project; containers cannot reach a host-local
Supabase on `127.0.0.1`). `.env` changes need `--build` because the frontend bakes `VITE_*` values in at build time.

### Deploy
Supabase (auth + DB) + Render (API) + Vercel (frontend): see `docs/deployment.md`.

## Tests
```bash
scripts/run_backend_tests.sh                   # throwaway local Postgres (needs PostgreSQL binaries); or use local Supabase's DB: see docs/testing-and-evaluation.md
scripts/run_backend_tests.sh tests/unit        # layers: tests/unit, tests/integration, tests/concurrency
cd backend && ruff check . && mypy app
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
cd frontend && npm run e2e:smoke               # CI smoke; E2E_FULL=1 npm run e2e for full flows (see docs)
```
Evaluation (concurrency experiment, k6 load test): `docs/testing-and-evaluation.md`.

## Limitations / roadmap
Single-capacity booking only; no email/push delivery (in-app notifications); no rate limiting yet
(put one in front of the API in production); deployment not performed; full-stack Playwright flows need a seeded Auth stack.

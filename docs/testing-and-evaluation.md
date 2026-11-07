# Testing and evaluation

## Auth in tests
Tests mint HS256 JWTs with a test secret and the API validates them through the **production code path**
(`verify_access_token`); there is no bypass in the application. Production uses Supabase JWKS/secret.

## Layers and commands
| Layer | Location | Command |
|---|---|---|
| Backend unit (policy, FIFO, fingerprints, errors, JWT) | `backend/tests/unit` | `scripts/run_backend_tests.sh tests/unit` |
| Integration (HTTP + real PostgreSQL, migrations, constraints, rollback) | `backend/tests/integration` | `scripts/run_backend_tests.sh tests/integration` |
| Concurrency (40 threads/own session, barrier-released; 5 rounds; idempotent races; cancel/promotion races) | `backend/tests/concurrency` | `scripts/run_backend_tests.sh tests/concurrency -m concurrency` |
| Frontend unit/component | `frontend/src/**/*.test.ts(x)` | `npm test` |
| E2E smoke (no backend) | `frontend/e2e/smoke.spec.ts` | `npm run e2e:smoke` |
| E2E full flows (book/cancel/waitlist promotion/admin/authz) | `frontend/e2e/flows.spec.ts` | `E2E_FULL=1 E2E_MEMBER_EMAIL=… E2E_MEMBER2_EMAIL=… E2E_ADMIN_EMAIL=… E2E_PASSWORD=… npm run e2e` against a running stack with those users seeded (admin role set in `profiles`) |

Coverage: `pytest --cov=app --cov-report=term-missing` (use it to find untested critical paths, not as proof).
Excluded from CI: full-stack Playwright (needs a live Auth provider) — run locally.

## Measured results (record only what you ran)
| Date | Experiment | Command | Result |
|---|---|---|---|
| 2026-10-21 | Schema constraints on PostgreSQL 16 (overlap EXCLUDE, one-confirmed index, duplicate waiting, CHECKs) via equivalent SQL | ad-hoc `psql` script | all 9 expectations held (rejections raised the intended constraint; back-to-back and cross-resource overlaps accepted). This did **not** execute the Alembic file itself. |
| 2026-10-22 | SQL migration `database/sql/migrations/0001_initial_schema.sql` on PostgreSQL 16 | `psql -v ON_ERROR_STOP=1 -f …` | applied cleanly; creates 8 tables + `alembic_version=0001`; re-run refused by guard; unique/exclusion constraints reject double booking and overlaps; `.down.sql` drops everything and UP re-applies. |
| 2026-10-23 | SQL migration `0002_lockdown_rls.sql` + `scripts/migrate_sql.sh` on PostgreSQL 16 with simulated `anon`/`authenticated` roles | `scripts/migrate_sql.sh` | applied 0001→0002 on a fresh DB, re-run applied 0; all tables had RLS; anon/authenticated got `permission denied`; owner still read; down/up worked; 0002 refused without 0001. Not run against real Supabase. |
| — | pytest / ruff / mypy | — | **not run** (package registry unreachable in generating environment) |
| — | Vitest / tsc / eslint / build / Playwright | — | **not run** (same reason) |
| — | Concurrency experiment (`scripts/concurrency_eval.py`) | — | **not run** |
| — | k6 load test (`scripts/loadtest.js`) | — | **not run** |

Fill the table after running; for load tests also record hardware/container limits, DB size, VUs, duration, RPS, p50/p95/p99, error rate.
For query plans run `EXPLAIN (ANALYZE, BUFFERS)` on the slot search and booking history queries with a realistically sized dataset before adding indexes.

## Running backend tests against local Supabase's Postgres
```bash
npx supabase start
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "create database reservehub_test"
cd backend && TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/reservehub_test pytest
```
(The fixtures drop and recreate the `public` schema of that database, and refuse names that do not contain "test".)
Alternatively `scripts/run_backend_tests.sh` starts a throwaway Postgres if PostgreSQL binaries are installed.

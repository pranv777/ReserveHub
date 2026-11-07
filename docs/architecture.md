# Architecture

**Modular monolith.** One FastAPI service, one PostgreSQL database, one static React app.

| Layer | Responsibility |
|---|---|
| `frontend/` | UI, form validation (UX only), calls the API through `src/lib/api`. Supabase JS is used only for sign-in/up/out; the access token is attached by the API client. |
| `backend/app/api` | HTTP routes, dependency injection (auth, DB session), request/response schemas, **commit boundary** (routes call `db.commit()`). |
| `backend/app/services` | Business logic. Never commits. `policy.py` holds pure rules (state machine, FIFO pick, fingerprints). |
| `backend/app/models`, `migrations` | Schema; Alembic is the only migration path (no `create_all`). |
| `backend/app/core` | Config, JWT verification, errors, JSON logging with request IDs. |

**Request flow:** middleware assigns/accepts `X-Request-ID` and logs one structured line →
`get_current_user` verifies the JWT, loads/creates the `profiles` row (role from DB, default `member`) →
route calls a service inside one session/transaction → route commits → response DTO.
Any exception leaves the session to roll back on close.

**Authorization policy:** admin routes require `profiles.role='admin'`. Per-object access to bookings,
waitlist entries and notifications returns **404** (not 403) for other users' objects so existence is not leaked.
Admin-only permission failures return 403 `admin_required`. There is a single admin role (no separate staff).

**Cancellation policy:** a confirmed booking may be cancelled any time before its slot starts.
**Timestamps:** `timestamptz` (UTC) everywhere; API requires timezone-aware input; the UI renders local time and says so.
**Availability** is derived (`EXISTS` confirmed booking) — there is no `is_booked` column to drift.

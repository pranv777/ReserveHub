# API and errors

Base path `/api/v1`; interactive docs at `/docs`. All endpoints except `health/*` need `Authorization: Bearer <token>`.

| Method & path | Who | Notes |
|---|---|---|
| GET `/health/live`, `/health/ready` | public | ready checks the DB (503 `database_unavailable`) |
| GET `/me` | user | profile + role |
| GET/POST `/resources`, GET/PATCH `/resources/{id}`, POST `/resources/{id}/deactivate` | read: user; write: admin | members only see active resources |
| GET `/slots`, GET `/slots/{id}` | user | filters: `resource_id,location,category,start_from,start_to,available_only`; includes derived `is_available`, `booked_by_me`, `waitlist_count` |
| POST `/resources/{id}/slots`, PATCH `/slots/{id}` | admin | future-only, no overlap, unbooked-only edits |
| POST `/bookings` | user | **requires `Idempotency-Key` (8–128 chars)**; identity from token only |
| GET `/bookings/me`, GET `/bookings/{id}`, POST `/bookings/{id}/cancel` | owner | `when=all|upcoming|past` |
| POST `/slots/{id}/waitlist`, GET `/waitlist/me`, DELETE `/waitlist/{id}` | owner | 204 on leave |
| GET `/notifications/me`, POST `/notifications/{id}/read` | owner | |
| GET `/admin/bookings`, GET `/admin/audit-events` | admin | filters + pagination |

**Pagination:** `page` (≥1), `page_size` (1–100, default 20); response `{items,total,page,page_size}`; ordering always ends with a unique id.

**Error envelope:** `{"error":{"code","message","request_id","details?"}}`; `X-Request-ID` header mirrors it.

| Situation | Status / code | Retriable | Rolled back |
|---|---|---|---|
| Missing / bad token | 401 `not_authenticated`, `invalid_token` | after re-login | n/a |
| Expired token | 401 `token_expired` | after refresh | n/a |
| Not admin | 403 `admin_required`; disabled account 403 `account_disabled` | no | n/a |
| Other user's booking/entry/notification | 404 `*_not_found` | no | n/a |
| Slot taken between search and book | 409 `slot_unavailable` | no (pick another / waitlist) | yes |
| Resource deactivated / slot started | 409 `resource_inactive` / `slot_in_past` | no | yes |
| Missing/short Idempotency-Key | 400 `idempotency_key_required` | fix request | n/a |
| Key reused, different payload | 409 `idempotency_key_reuse` | no | yes |
| Invalid transition / late cancel | 409 `invalid_state_transition` / `cancellation_window_closed` | no | yes |
| Slot overlap / booked slot edit | 409 `slot_overlap` / `slot_has_booking` | no | yes |
| Join waitlist: free slot, duplicate, holder | 409 `slot_available` / `already_waiting` / `already_booked` | no | yes |
| Bad dates/limits/malformed | 400 (`invalid_time_range`, `slot_in_past`, `slot_too_long`), 422 `validation_error` | fix request | n/a |
| Promotion/notification failure during cancel | 500 `internal_error`, **whole cancel+promotion rolled back** | **yes** | yes |
| DB down | 503 on `/health/ready`; 500 elsewhere | yes | n/a |
| Network loss in browser | UI "Cannot reach the server" with retry | yes (same Idempotency-Key reused by the UI for the same attempt) | n/a |

**Idempotency:** same key + same payload → same stored response (replayed with its original status). Same key + different
payload → 409. Only **successful** bookings are stored; deterministic conflicts and 5xx roll back with the transaction, so no
record survives (a retry re-evaluates). Concurrent duplicates serialize on the unique key.

# 0003 — Idempotent booking
**Decision:** `Idempotency-Key` required. Inside the booking transaction: `INSERT … ON CONFLICT DO NOTHING` on `(user_id, scope, key)`. If inserted, proceed and store `(status, body)` before commit. If it conflicted, the statement waits for the other transaction: after its commit we replay the stored response (or 409 if the fingerprint differs); after its rollback the insert succeeds and we proceed.
**Why:** the record commits atomically with the booking, so a success-shaped record without a booking is impossible, and concurrent duplicates cannot both create bookings. No in-memory state.
**Cached outcomes:** successful bookings only; conflicts/failures roll back and are re-evaluated on retry.

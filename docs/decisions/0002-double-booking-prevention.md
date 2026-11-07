# 0002 — Preventing double-booking
**Decision:** every slot mutation first takes `SELECT … FOR UPDATE` on the slot row (`lock_slot`), then re-checks state inside the transaction. A partial unique index on `bookings(slot_id) WHERE status='confirmed'` is the final guard; its violation maps to 409 `slot_unavailable`.
**Why:** locking gives ordered, deadlock-free serialization (slot first, always); the index guarantees safety even if a code path forgets the lock.
**Consequence:** contention only on the contested slot; losers get a clean 409 and leave no records.

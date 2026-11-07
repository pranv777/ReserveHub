# 0004 — Atomic cancellation and waitlist promotion
**Decision:** `cancel_booking` locks the slot, re-reads the booking, validates the transition and window, marks it cancelled, then (same transaction) selects waiting entries `ORDER BY created_at, id FOR UPDATE`, retires ineligible ones (inactive users) as `expired`, inserts the promoted booking, updates the entry, and writes notification + audit rows.
**Why:** holding the slot lock across cancel+promote means the slot is never observably free while a waitlist exists (new bookers lose), only one promoter runs per slot, and any failure (e.g. notification insert) rolls back everything; the client may retry.
**Consequence:** `leave waitlist` also takes the slot lock so it serializes with promotion.

# 0001 — Modular monolith
**Decision:** one FastAPI app with module boundaries (routes → services → models), one PostgreSQL DB.
**Why:** one developer; correctness depends on single-transaction guarantees across bookings, waitlist, audit and notifications, which microservices would turn into distributed-consistency problems.
**Consequence:** simple deploys and tests; can split later along service modules if scale demands.

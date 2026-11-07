#!/usr/bin/env python3
"""Black-box evaluation against a RUNNING API (HTTP). Reports measured outcomes only.

Needs a database whose users/admin exist; it mints test tokens, so the API must be started with
SUPABASE_JWT_SECRET equal to --secret (use a throwaway local stack, never production).

  python scripts/concurrency_eval.py --base http://localhost:8000 --secret <hs256> \
      --database-url postgresql://... --attempts 40 --rounds 10
"""
import argparse
import json
import threading
import time
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import psycopg


def token(secret, uid):
    now = int(time.time())
    return jwt.encode({"sub": str(uid), "aud": "authenticated", "iat": now, "exp": now + 3600}, secret, algorithm="HS256")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--secret", required=True)
    ap.add_argument("--database-url", required=True, help="plain postgresql:// URL")
    ap.add_argument("--attempts", type=int, default=40)
    ap.add_argument("--rounds", type=int, default=10)
    a = ap.parse_args()

    admin = uuid.uuid4()
    with psycopg.connect(a.database_url, autocommit=True) as db:
        db.execute("INSERT INTO profiles (id,email,role) VALUES (%s,%s,'admin')", (admin, f"{admin.hex[:8]}@eval.test"))
        rid = db.execute("INSERT INTO resources (name) VALUES (%s) RETURNING id", (f"eval-{uuid.uuid4().hex[:6]}",)).fetchone()[0]
        results = {"same_slot_race": [], "idempotent_race": None}

        def fire(n, fn):
            barrier = threading.Barrier(n)
            def run(i):
                with httpx.Client(base_url=a.base, timeout=30) as c:
                    barrier.wait()
                    return fn(i, c)
            with ThreadPoolExecutor(n) as pool:
                return list(pool.map(run, range(n)))

        for rnd in range(a.rounds):
            start = datetime.now(UTC) + timedelta(days=30 + rnd)
            sid = db.execute("INSERT INTO availability_slots (resource_id,start_at,end_at) VALUES (%s,%s,%s) RETURNING id",
                             (rid, start, start + timedelta(hours=1))).fetchone()[0]
            users = [uuid.uuid4() for _ in range(a.attempts)]
            for u in users:
                db.execute("INSERT INTO profiles (id,email) VALUES (%s,%s)", (u, f"{u.hex[:8]}@eval.test"))
            def book(i, c, sid=sid, users=users):
                return c.post("/api/v1/bookings", json={"slot_id": str(sid)},
                              headers={"Authorization": f"Bearer {token(a.secret, users[i])}", "Idempotency-Key": uuid.uuid4().hex}).status_code
            codes = Counter(fire(a.attempts, book))
            active = db.execute("SELECT count(*) FROM bookings WHERE slot_id=%s AND status='confirmed'", (sid,)).fetchone()[0]
            results["same_slot_race"].append({"round": rnd, "codes": dict(codes), "active_bookings": active,
                                              "invariant_held": active == 1 and codes.get(201, 0) == 1 and set(codes) <= {201, 409}})

        start = datetime.now(UTC) + timedelta(days=200)
        sid = db.execute("INSERT INTO availability_slots (resource_id,start_at,end_at) VALUES (%s,%s,%s) RETURNING id",
                         (rid, start, start + timedelta(hours=1))).fetchone()[0]
        user = uuid.uuid4()
        db.execute("INSERT INTO profiles (id,email) VALUES (%s,%s)", (user, f"{user.hex[:8]}@eval.test"))
        key = uuid.uuid4().hex
        def idem(i, c):
            r = c.post("/api/v1/bookings", json={"slot_id": str(sid)},
                       headers={"Authorization": f"Bearer {token(a.secret, user)}", "Idempotency-Key": key})
            return r.status_code, r.json().get("id")
        out = fire(a.attempts, idem)
        n_bookings = db.execute("SELECT count(*) FROM bookings WHERE slot_id=%s", (sid,)).fetchone()[0]
        results["idempotent_race"] = {"attempts": a.attempts, "status_codes": dict(Counter(c for c, _ in out)),
                                      "distinct_booking_ids": len({i for _, i in out}), "bookings_in_db": n_bookings,
                                      "invariant_held": n_bookings == 1 and len({i for _, i in out}) == 1}
        with httpx.Client(base_url=a.base) as c:
            other = c.post("/api/v1/bookings", json={"slot_id": str(uuid.uuid4())},
                           headers={"Authorization": f"Bearer {token(a.secret, user)}", "Idempotency-Key": key})
        results["key_reuse_different_payload_status"] = other.status_code
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()

"""Real concurrency against PostgreSQL: independent threads, each with its own client and
its own DB session/transaction, released together by a barrier."""

import threading
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import book, count, create_resource, create_slot, create_user

pytestmark = pytest.mark.concurrency
ATTEMPTS = 40


def fire(n, fn):
    barrier = threading.Barrier(n)

    def run(i):
        client = TestClient(app)
        barrier.wait(timeout=30)
        return fn(i, client)

    with ThreadPoolExecutor(max_workers=n) as pool:
        return list(pool.map(run, range(n)))


@pytest.mark.parametrize("round_no", range(5))
def test_many_users_race_for_one_slot(round_no):
    slot = create_slot(create_resource(f"Race {round_no}"))
    users = [create_user() for _ in range(ATTEMPTS)]
    results = fire(ATTEMPTS, lambda i, c: book(c, users[i], slot.id))

    codes = Counter(r.status_code for r in results)
    assert codes == {201: 1, 409: ATTEMPTS - 1}, codes
    assert {r.json()["error"]["code"] for r in results if r.status_code == 409} == {
        "slot_unavailable"
    }
    assert count("bookings", f"slot_id='{slot.id}' AND status='confirmed'") == 1
    assert count("bookings") == 1
    # losers left nothing behind
    assert count("idempotency_records") == 1
    assert count("notifications") == 1
    assert count("audit_events", "event_type='booking.created'") == 1
    winner = next(r for r in results if r.status_code == 201).json()
    assert count("bookings", f"id='{winner['id']}' AND user_id='{winner['user_id']}'") == 1


def test_identical_idempotent_requests_create_one_booking():
    user = create_user()
    slot = create_slot(create_resource())
    results = fire(30, lambda i, c: book(c, user, slot.id, key="same-key-for-all"))
    assert {r.status_code for r in results} == {201}
    assert len({r.json()["id"] for r in results}) == 1
    assert count("bookings") == 1
    assert count("idempotency_records") == 1
    assert count("notifications") == 1


def test_same_key_different_payloads_race():
    user = create_user()
    res = create_resource()
    s1, s2 = create_slot(res, start_in_hours=10), create_slot(res, start_in_hours=20)
    slots = [s1, s2]
    results = fire(20, lambda i, c: book(c, user, slots[i % 2].id, key="contested-key-1"))
    codes = Counter(r.status_code for r in results)
    assert codes[201] >= 1 and set(codes) <= {201, 409}
    assert count("bookings") == 1  # whichever payload won, only it exists
    assert count("idempotency_records") == 1


def test_cancel_and_promotion_race_never_leaves_gap_or_double_booking():
    owner = create_user()
    slot = create_slot(create_resource("Promo"))
    bid = book(TestClient(app), owner, slot.id).json()["id"]
    waiting = [create_user() for _ in range(3)]
    client = TestClient(app)
    for u in waiting:
        assert (
            client.post(f"/api/v1/slots/{slot.id}/waitlist", headers=u.headers).status_code == 201
        )
    newcomers = [create_user() for _ in range(10)]

    def op(i, c):
        if i < 10:  # ten duplicate cancel attempts by the owner
            return ("cancel", c.post(f"/api/v1/bookings/{bid}/cancel", headers=owner.headers))
        return ("book", book(c, newcomers[i - 10], slot.id))

    results = fire(20, op)
    cancels = [r for kind, r in results if kind == "cancel"]
    books = [r for kind, r in results if kind == "book"]
    assert Counter(r.status_code for r in cancels) == {200: 1, 409: 9}
    # The slot is never free between cancel and promotion, so every newcomer loses.
    assert {r.status_code for r in books} == {409}
    assert count("bookings", "status='confirmed'") == 1
    first = waiting[0]
    assert (
        count("bookings", f"user_id='{first.id}' AND status='confirmed' AND source='waitlist'") == 1
    )
    assert count("waitlist_entries", "status='waiting'") == 2
    assert count("waitlist_entries", "status='promoted'") == 1
    assert count("notifications", "type='waitlist_promoted'") == 1


def test_concurrent_cancels_on_many_slots_do_not_deadlock():
    slots, owners, bids = [], [], []
    res = create_resource("Many")
    c0 = TestClient(app)
    for i in range(8):
        s = create_slot(res, start_in_hours=10 + i * 2)
        o, w = create_user(), create_user()
        bids.append(book(c0, o, s.id).json()["id"])
        c0.post(f"/api/v1/slots/{s.id}/waitlist", headers=w.headers)
        slots.append(s)
        owners.append(o)
    results = fire(
        8, lambda i, c: c.post(f"/api/v1/bookings/{bids[i]}/cancel", headers=owners[i].headers)
    )
    assert {r.status_code for r in results} == {200}
    assert count("bookings", "status='confirmed'") == 8  # one promoted booking per slot
    assert count("waitlist_entries", "status='promoted'") == 8


def test_leave_waitlist_races_with_promotion():
    for _ in range(5):
        owner, waiter = create_user(), create_user()
        slot = create_slot(create_resource(f"LW {uuid.uuid4().hex[:6]}"))
        c0 = TestClient(app)
        bid = book(c0, owner, slot.id).json()["id"]
        entry = c0.post(f"/api/v1/slots/{slot.id}/waitlist", headers=waiter.headers).json()["id"]

        def op(i, c, bid=bid, entry=entry, owner=owner, waiter=waiter):
            if i == 0:
                return ("cancel", c.post(f"/api/v1/bookings/{bid}/cancel", headers=owner.headers))
            return ("leave", c.delete(f"/api/v1/waitlist/{entry}", headers=waiter.headers))

        results = dict(fire(2, op))
        assert results["cancel"].status_code == 200
        confirmed = count("bookings", f"slot_id='{slot.id}' AND status='confirmed'")
        if results["leave"].status_code == 204:
            assert confirmed == 0  # left first: nobody promoted
        else:
            assert results["leave"].json()["error"]["code"] == "waitlist_not_active"
            assert confirmed == 1  # promoted first: leave rejected
        assert confirmed <= 1

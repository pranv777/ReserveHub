import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import BadRequestError, ConflictError
from app.services import policy

NOW = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)


def _t(h):
    return NOW + timedelta(hours=h)


def test_slot_times_valid():
    policy.validate_slot_times(_t(1), _t(2), NOW)


@pytest.mark.parametrize(
    ("start", "end", "code"),
    [
        (_t(2), _t(1), "invalid_time_range"),
        (_t(1), _t(1), "invalid_time_range"),
        (_t(-1), _t(1), "slot_in_past"),
        (NOW, _t(1), "slot_in_past"),
        (_t(1), _t(30), "slot_too_long"),
    ],
)
def test_slot_times_invalid(start, end, code):
    with pytest.raises(BadRequestError) as exc:
        policy.validate_slot_times(start, end, NOW)
    assert exc.value.code == code


def test_overlap_is_half_open():
    assert policy.intervals_overlap(_t(1), _t(3), _t(2), _t(4))
    assert policy.intervals_overlap(_t(1), _t(4), _t(2), _t(3))
    assert not policy.intervals_overlap(_t(1), _t(2), _t(2), _t(3))  # back-to-back is fine
    assert not policy.intervals_overlap(_t(1), _t(2), _t(5), _t(6))


def test_transitions():
    policy.assert_transition("confirmed", "cancelled")
    for cur, tgt in [
        ("cancelled", "confirmed"),
        ("cancelled", "cancelled"),
        ("confirmed", "confirmed"),
        ("confirmed", "bogus"),
    ]:
        with pytest.raises(ConflictError) as exc:
            policy.assert_transition(cur, tgt)
        assert exc.value.code == "invalid_state_transition"


def test_cancellation_window():
    policy.assert_cancellable(_t(1), NOW)
    with pytest.raises(ConflictError) as exc:
        policy.assert_cancellable(_t(-1), NOW)
    assert exc.value.code == "cancellation_window_closed"


def test_ownership_and_roles():
    a, b = uuid.uuid4(), uuid.uuid4()
    assert policy.owns(a, a)
    assert not policy.owns(a, b)
    assert policy.is_admin("admin")
    assert not policy.is_admin("member")


def _c(minutes, status="waiting", active=True):
    return policy.WaitlistCandidate(
        uuid.uuid4(), _t(0) + timedelta(minutes=minutes), status, active
    )


def test_waitlist_is_fifo_regardless_of_input_order():
    first, second, third = _c(1), _c(2), _c(3)
    chosen, skipped = policy.pick_next_waitlist([third, first, second], _t(5), NOW)
    assert chosen == first
    assert skipped == []


def test_waitlist_skips_ineligible_and_reports_them():
    gone = _c(1, active=False)
    cancelled = _c(2, status="cancelled")
    ok = _c(3)
    later = _c(4)
    chosen, skipped = policy.pick_next_waitlist([later, ok, cancelled, gone], _t(5), NOW)
    assert chosen == ok
    assert skipped == [gone]  # non-waiting entries are ignored, inactive users are retired


def test_waitlist_none_when_nobody_eligible_or_slot_started():
    only = _c(1, active=False)
    assert policy.pick_next_waitlist([only], _t(5), NOW) == (None, [only])
    chosen, _ = policy.pick_next_waitlist([_c(1)], _t(-1), NOW)
    assert chosen is None
    assert policy.pick_next_waitlist([], _t(5), NOW) == (None, [])


def test_fingerprint_is_stable_and_discriminating():
    f = policy.request_fingerprint
    assert f({"slot_id": "a", "x": 1}) == f({"x": 1, "slot_id": "a"})
    assert f({"slot_id": "a"}) != f({"slot_id": "b"})
    assert len(f({"slot_id": "a"})) == 64

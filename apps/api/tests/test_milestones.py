from datetime import datetime, timezone

from app.domain.milestones import evaluate, total_on_offer
from tests.conftest import METRICS, START, entry, kyp_milestones


def utc(*args):
    return datetime(*args, tzinfo=timezone.utc)


def run(entries, now, milestones=None):
    return evaluate(milestones or kyp_milestones(), entries, METRICS, START, now)


def test_first_milestone_opens_at_start():
    r = run([], utc(2026, 6, 1))
    assert [m.status for m in r.milestones] == ["open", "locked", "locked", "locked"]
    assert r.milestones[0].opened_at == START
    assert not r.vested and not r.voided


def test_idempotent():
    first = run([], utc(2026, 6, 10))
    second = evaluate(first.milestones, [], METRICS, START, utc(2026, 6, 10))
    assert second.milestones == first.milestones
    assert not second.vested and not second.events


def test_clear_vests_with_triggering_entry_and_opens_next():
    entries = [entry("2026-06-01", 1, 0, 0, "le_w1"), entry("2026-06-08", 3, 0, 0, "le_w2")]
    r = run(entries, utc(2026, 6, 10))
    first, second = r.milestones[0], r.milestones[1]
    assert first.status == "cleared" and first.cleared_by_ledger_entry_id == "le_w2"
    assert r.vested[0].milestone_id == "ms_a" and r.vested[0].tranche_pct == 2 and r.vested[0].ledger_entry_id == "le_w2"
    assert second.status == "open" and second.opened_at == first.cleared_at
    assert r.proving_run_outcome == "cleared"


def test_sum_metric_is_cumulative():
    initial = run([entry("2026-06-01", 3, 99999, 0)], utc(2026, 6, 3))
    entries = [entry("2026-06-08", 3, 10000, 0), entry("2026-06-15", 3, 15000, 0, "le_rev")]
    r = evaluate(initial.milestones, entries, METRICS, START, utc(2026, 6, 20))
    assert r.milestones[1].status == "cleared" and r.milestones[1].cleared_by_ledger_entry_id == "le_rev"


def test_several_clear_in_one_pass_and_never_twice():
    entries = [entry("2026-06-01", 3, 25000, 0), entry("2026-06-08", 10, 0, 100)]
    r = run(entries, utc(2026, 6, 10))
    assert [m.status for m in r.milestones] == ["cleared", "open", "locked", "locked"]
    assert [v.tranche_pct for v in r.vested] == [2]
    assert not r.all_cleared
    again = evaluate(r.milestones, entries, METRICS, START, utc(2026, 6, 11))
    assert not again.vested


def test_window_expiry_misses_voids_and_notifies_then_opens_next():
    r = run([entry("2026-06-01", 2, 0, 0)], utc(2026, 7, 16))
    assert r.milestones[0].status == "missed" and r.milestones[0].missed_at == utc(2026, 7, 16)
    assert r.voided[0].milestone_id == "ms_a" and r.voided[0].reason == "missed"
    assert len(r.notifications) == 1 and not r.vested
    assert all(m.status == "locked" for m in r.milestones[1:])
    assert r.proving_run_outcome == "missed"


def test_not_missed_one_second_before_deadline():
    r = run([], utc(2026, 7, 15, 23, 59, 59))
    assert r.milestones[0].status == "open" and not r.voided


def test_hit_after_deadline_does_not_clear_but_hit_inside_does():
    late = run([entry("2026-07-20", 3, 0, 0)], utc(2026, 7, 21))
    assert late.milestones[0].status == "missed" and not late.vested
    inside = run([entry("2026-07-13", 3, 0, 0)], utc(2026, 8, 1))
    assert inside.milestones[0].status == "cleared" and len(inside.vested) == 1


def test_total_on_offer():
    assert total_on_offer(kyp_milestones()) == 12
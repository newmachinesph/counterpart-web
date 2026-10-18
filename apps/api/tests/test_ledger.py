from datetime import date, datetime, timezone

import pytest

from app.domain.ledger import LedgerValidation, WeekClosed, aggregate, check_week_writable, is_week_closed, ledger_weeks, validate_values, week_close_at, week_start_of
from tests.conftest import METRICS, entry


def utc(*args):
    return datetime(*args, tzinfo=timezone.utc)


def test_week_start_is_monday():
    assert week_start_of(utc(2026, 6, 3, 10)) == date(2026, 6, 1)
    assert week_start_of(utc(2026, 6, 7, 23, 59)) == date(2026, 6, 1)
    assert week_start_of(utc(2026, 6, 8)) == date(2026, 6, 8)


def test_week_closes_seven_days_after_start():
    assert week_close_at(date(2026, 6, 1)) == utc(2026, 6, 8)
    assert not is_week_closed(date(2026, 6, 1), utc(2026, 6, 7, 23, 59, 59))
    assert is_week_closed(date(2026, 6, 1), utc(2026, 6, 8))


def test_closed_week_is_read_only():
    check_week_writable(date(2026, 6, 1), utc(2026, 6, 7, 23))
    with pytest.raises(WeekClosed):
        check_week_writable(date(2026, 6, 1), utc(2026, 6, 8))


def test_future_week_and_non_monday_are_rejected():
    with pytest.raises(LedgerValidation):
        check_week_writable(date(2026, 6, 8), utc(2026, 6, 5))
    with pytest.raises(LedgerValidation):
        check_week_writable(date(2026, 6, 2), utc(2026, 6, 3))


def test_values_must_cover_every_metric_and_nothing_else():
    validate_values({"merchants_live": 1, "revenue_php": 0, "paying_users": 0}, METRICS)
    with pytest.raises(LedgerValidation):
        validate_values({"merchants_live": 1}, METRICS)
    with pytest.raises(LedgerValidation):
        validate_values({"merchants_live": 1, "revenue_php": -5, "paying_users": 0}, METRICS)
    with pytest.raises(LedgerValidation):
        validate_values({"merchants_live": 1, "revenue_php": 0, "paying_users": 0, "bogus": 1}, METRICS)


def test_aggregation_sum_and_latest():
    entries = [entry("2026-06-01", 1, 100, 0), entry("2026-06-15", 3, 250, 5), entry("2026-06-08", 2, 50, 2)]
    assert aggregate(entries, METRICS[1]) == 400
    assert aggregate(entries, METRICS[0]) == 3
    assert aggregate([], METRICS[1]) == 0


def test_gaps_are_explicit():
    entries = [entry("2026-06-01", 1, 0, 0), entry("2026-06-15", 2, 100, 0)]
    weeks = ledger_weeks(entries, date(2026, 6, 1), utc(2026, 6, 24))
    assert [w[0].isoformat() for w in weeks] == ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"]
    assert [w[1] is not None for w in weeks] == [True, False, True, False]
    assert [w[2] for w in weeks] == [True, True, True, False]
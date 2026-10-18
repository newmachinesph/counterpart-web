"""Traction ledger rules. Weeks start Monday. A week closes 7 days after it
starts and its entry is read-only from then on. All math in UTC."""
from dataclasses import dataclass, field
import math
from datetime import date, datetime, timedelta, timezone

WEEK = timedelta(days=7)


class WeekClosed(Exception):
    pass


class LedgerValidation(Exception):
    pass


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    unit: str  # "php" | "count"
    aggregation: str  # "sum" | "latest"


@dataclass
class Entry:
    id: str
    week_starting: date
    values: dict[str, float]
    updated_at: datetime
    note: str = ""
    evidence_links: list[str] = field(default_factory=list)


def week_start_of(moment: datetime) -> date:
    d = moment.astimezone(timezone.utc).date()
    return d - timedelta(days=d.weekday())


def is_monday(day: date) -> bool:
    return day.weekday() == 0


def week_close_at(week_starting: date) -> datetime:
    return datetime(week_starting.year, week_starting.month, week_starting.day, tzinfo=timezone.utc) + WEEK


def is_week_closed(week_starting: date, now: datetime) -> bool:
    return now >= week_close_at(week_starting)


def validate_values(values: dict[str, float], metrics: list[Metric]) -> None:
    allowed = {m.key for m in metrics}
    for key in values:
        if key not in allowed:
            raise LedgerValidation(f'"{key}" is not a metric on this venture')
    for m in metrics:
        v = values.get(m.key)
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            raise LedgerValidation(f"A number is required for {m.label}")
        if not math.isfinite(v) or v < 0:
            raise LedgerValidation(f"{m.label} cannot be negative")


def check_week_writable(week_starting: date, now: datetime) -> None:
    if not is_monday(week_starting):
        raise LedgerValidation(f"Week must start on a Monday, got {week_starting}")
    if datetime(week_starting.year, week_starting.month, week_starting.day, tzinfo=timezone.utc) > now:
        raise LedgerValidation(f"The week starting {week_starting} has not started yet")
    if is_week_closed(week_starting, now):
        raise WeekClosed(f"The week starting {week_starting} has closed and its entry is read-only")


def sorted_entries(entries: list[Entry]) -> list[Entry]:
    return sorted(entries, key=lambda e: e.week_starting)


def aggregate(entries: list[Entry], metric: Metric) -> float:
    ordered = sorted_entries(entries)
    if not ordered:
        return 0
    if metric.aggregation == "sum":
        return sum(e.values.get(metric.key, 0) for e in ordered)
    return ordered[-1].values.get(metric.key, 0)


def first_entry_reaching(entries: list[Entry], metric: Metric, target: float) -> Entry | None:
    running = 0.0
    for e in sorted_entries(entries):
        v = e.values.get(metric.key, 0)
        running = running + v if metric.aggregation == "sum" else v
        if running >= target:
            return e
    return None


def ledger_weeks(entries: list[Entry], from_week: date, now: datetime) -> list[tuple[date, Entry | None, bool]]:
    by_week = {e.week_starting: e for e in entries}
    last = week_start_of(now)
    cursor = from_week - timedelta(days=from_week.weekday())
    out = []
    while cursor <= last:
        out.append((cursor, by_week.get(cursor), is_week_closed(cursor, now)))
        cursor += WEEK
    return out

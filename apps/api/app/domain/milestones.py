"""Milestone auto-clear and vesting. Pure and idempotent.

Milestones open in sequence, one at a time. A milestone clears when the
ledger's aggregated value for its metric reaches the target using a week
that started on or before the deadline. Clearing writes a vesting tranche
with the triggering entry. An expired window voids the tranche and notifies
both parties. Voiding a tranche is separate from ending the pairing.
"""
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone

from app.domain.ledger import Entry, Metric, first_entry_reaching


@dataclass
class MilestoneState:
    id: str
    sequence: int
    title: str
    metric_key: str
    target_value: float
    tranche_pct: float
    window_days: int
    is_proving_run: bool
    status: str = "locked"
    opened_at: datetime | None = None
    cleared_at: datetime | None = None
    missed_at: datetime | None = None
    cleared_by_ledger_entry_id: str | None = None


@dataclass
class Vested:
    milestone_id: str
    tranche_pct: float
    vested_at: datetime
    ledger_entry_id: str


@dataclass
class Voided:
    milestone_id: str
    tranche_pct: float
    voided_at: datetime
    reason: str


@dataclass
class Evaluation:
    milestones: list[MilestoneState]
    vested: list[Vested] = field(default_factory=list)
    voided: list[Voided] = field(default_factory=list)
    notifications: list[str] = field(default_factory=list)
    events: list[tuple[str, str]] = field(default_factory=list)
    proving_run_outcome: str | None = None
    all_cleared: bool = False


def deadline_of(m: MilestoneState) -> datetime | None:
    if m.opened_at is None:
        return None
    return m.opened_at + timedelta(days=m.window_days)


def _day_start(d) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def evaluate(milestones: list[MilestoneState], entries: list[Entry], metrics: list[Metric], started_at: datetime, now: datetime) -> Evaluation:
    by_key = {m.key: m for m in metrics}
    ordered = sorted(milestones, key=lambda m: m.sequence)
    out = Evaluation(milestones=[])
    open_at: datetime | None = started_at

    for original in ordered:
        m = replace(original)
        if m.status in ("cleared", "missed"):
            open_at = m.cleared_at or m.missed_at
            out.milestones.append(m)
            continue
        if m.status == "locked":
            if open_at is None:
                out.milestones.append(m)
                continue
            m.status = "open"
            m.opened_at = open_at
            out.events.append(("opened", m.id))

        metric = by_key.get(m.metric_key)
        if metric is None:
            raise ValueError(f'Milestone {m.id} references unknown metric "{m.metric_key}"')
        deadline = deadline_of(m)
        assert deadline is not None

        eligible = [e for e in entries if m.opened_at < e.updated_at <= min(deadline, now)]
        trigger = first_entry_reaching(eligible, metric, m.target_value)
        if trigger is not None:
            m.status = "cleared"
            m.cleared_at = trigger.updated_at
            m.cleared_by_ledger_entry_id = trigger.id
            out.vested.append(Vested(m.id, m.tranche_pct, trigger.updated_at, trigger.id))
            out.events.append(("cleared", m.id))
            if m.is_proving_run:
                out.proving_run_outcome = "cleared"
            open_at = trigger.updated_at
            out.milestones.append(m)
            continue

        if now >= deadline:
            m.status = "missed"
            m.missed_at = deadline
            out.voided.append(Voided(m.id, m.tranche_pct, deadline, "missed"))
            out.notifications.append(f'Milestone "{m.title}" was not met within {m.window_days} days. Its {m.tranche_pct:g}% tranche is voided.')
            out.events.append(("missed", m.id))
            if m.is_proving_run:
                out.proving_run_outcome = "missed"
                out.milestones.append(m)
                out.milestones.extend(replace(rest) for rest in ordered[len(out.milestones):])
                break
            open_at = deadline
            out.milestones.append(m)
            continue

        open_at = None
        out.milestones.append(m)

    out.all_cleared = bool(out.milestones) and all(m.status == "cleared" for m in out.milestones)
    return out


def void_unvested(milestones: list[MilestoneState], reason: str, now: datetime) -> list[Voided]:
    return [Voided(m.id, m.tranche_pct, now, reason) for m in milestones if m.status in ("open", "locked")]


def reset(milestones: list[MilestoneState]) -> list[MilestoneState]:
    return [replace(m, status="locked", opened_at=None, cleared_at=None, missed_at=None, cleared_by_ledger_entry_id=None) for m in milestones]


def total_on_offer(milestones: list[MilestoneState]) -> float:
    return round(sum(m.tranche_pct for m in milestones), 2)

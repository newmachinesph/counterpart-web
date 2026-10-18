"""Pairing service. Owns every state change."""
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain import milestones as dm
from app.domain.equity import profitability_progress
from app.domain.ledger import Entry, Metric, aggregate, ledger_weeks, week_start_of
from app.domain.pairing import next_state
from app.models import LedgerEntry, Milestone, Pairing, User, Venture, VestingEntry, VoidedTranche
from app.services.common import Forbidden, NotFound, Validation, new_id, now_utc
from app.services.notifications import notify


def can_view(user: User, p: Pairing) -> bool:
    return "admin" in user.roles or p.builder_id == user.id or p.counterpart_id == user.id


def assert_can_view(user: User, p: Pairing) -> None:
    if not can_view(user, p):
        raise Forbidden("This pairing is not yours")


def assert_is_party(user: User, p: Pairing) -> None:
    if not ("admin" in user.roles or p.builder_id == user.id or p.counterpart_id == user.id):
        raise Forbidden("Only the builder or the Counterpart can do this")


def get(db: Session, pairing_id: str) -> Pairing:
    p = db.get(Pairing, pairing_id)
    if p is None:
        raise NotFound("Pairing not found")
    return p


def list_for(db: Session, user: User) -> list[Pairing]:
    rows = db.scalars(select(Pairing).order_by(Pairing.started_at.desc())).all()
    if "admin" in user.roles:
        return list(rows)
    return [p for p in rows if can_view(user, p)]


def metrics_of(v: Venture) -> list[Metric]:
    return [Metric(m["key"], m["label"], m["unit"], m["aggregation"]) for m in v.metrics]


def entries_of(db: Session, pairing_id: str) -> list[Entry]:
    rows = db.scalars(select(LedgerEntry).where(LedgerEntry.pairing_id == pairing_id)).all()
    return [Entry(r.id, r.week_starting, dict(r.values), r.updated_at, r.note, list(r.evidence_links)) for r in rows]


def _state(m: Milestone) -> dm.MilestoneState:
    return dm.MilestoneState(m.id, m.sequence, m.title, m.metric_key, m.target_value, m.tranche_pct, m.window_days, m.is_proving_run, m.status, m.opened_at, m.cleared_at, m.missed_at, m.cleared_by_ledger_entry_id)


def _apply(row: Milestone, s: dm.MilestoneState) -> None:
    row.status, row.opened_at, row.cleared_at, row.missed_at, row.cleared_by_ledger_entry_id = s.status, s.opened_at, s.cleared_at, s.missed_at, s.cleared_by_ledger_entry_id


def sync(db: Session, p: Pairing, now: datetime | None = None) -> Pairing:
    """Update commercial performance only. Historical equity requires documented review."""
    from app.services.commercial import expire
    now = now or now_utc()
    db.refresh(p, with_for_update=True)
    if p.protocol != "operator_v1" or p.state not in ("offered", "proving_run", "active", "cofounder"):
        return p
    expire(db, p, now)
    if p.state not in ("proving_run", "active", "cofounder"):
        db.commit()
        return p
    states = []
    for raw in p.milestone_snapshot:
        args = {key: raw[key] for key in dm.MilestoneState.__dataclass_fields__ if key in raw}
        for key in ("opened_at", "cleared_at", "missed_at"):
            if args.get(key):
                args[key] = datetime.fromisoformat(args[key])
        states.append(dm.MilestoneState(**args))
    metrics = [Metric(**m) for m in p.agreement["metrics"]]
    result = dm.evaluate(states, entries_of(db, p.id), metrics, p.started_at, now)
    snapshots = []
    for raw, state in zip(p.milestone_snapshot, result.milestones):
        values = {key: getattr(state, key) for key in state.__dataclass_fields__}
        snapshots.append({**raw, **{key: value.isoformat() if isinstance(value, datetime) else value for key, value in values.items()}})
    p.milestone_snapshot = snapshots
    db.commit()
    return p


def end(db: Session, user: User, p: Pairing, reason: str, now: datetime | None = None) -> Pairing:
    """Stop future service; preserve agreements, grants, evidence and accrued payments."""
    now = now or now_utc()
    assert_is_party(user, p)
    db.refresh(p, with_for_update=True)
    if p.state not in ("offered", "proving_run", "active", "cofounder"):
        raise Validation("This engagement has already ended")
    from app.services.commercial import effective_end
    cutoff = effective_end(p)
    p.ended_at = min(now, cutoff) if cutoff else now
    was_cofounder = p.state == "cofounder"
    p.state = "declined" if p.state == "offered" else "released"
    p.ended_by, p.end_reason = user.id, ("Cofounder departure: " if was_cofounder else "") + (reason.strip() or "Engagement ended")
    from app.services.commercial import reopen_application, expire
    if p.state == "declined":
        reopen_application(db, p)
    expire(db, p, now)
    other = p.counterpart_id if user.id == p.builder_id else p.builder_id
    notify(db, other, f"{user.name} ended the engagement. Accrued compensation and existing documented equity rights remain subject to the agreement.", f"/pairings/{p.id}")
    db.commit()
    return p


def request_review(db: Session, user: User, p: Pairing, message: str) -> None:
    assert_is_party(user, p)
    if not message.strip():
        raise Validation("Say what you want reviewed")
    from app.models import ReviewCase
    db.add(ReviewCase(id=new_id("case"), pairing_id=p.id, opened_by=user.id, message=message.strip(), status="open", created_at=now_utc()))
    other = p.counterpart_id if user.id == p.builder_id else p.builder_id
    notify(db, other, f"{user.name} requested a review: {message.strip()}", f"/pairings/{p.id}")
    for admin in db.scalars(select(User)).all():
        if "admin" in admin.roles:
            notify(db, admin.id, f"Review requested by {user.name}: {message.strip()}", f"/pairings/{p.id}")
    db.commit()


def dashboard(db: Session, user: User, p: Pairing, now: datetime | None = None) -> dict:
    now = now or now_utc()
    assert_can_view(user, p)
    v = db.get(Venture, p.venture_id)
    builder, counterpart = db.get(User, p.builder_id), db.get(User, p.counterpart_id)
    entries = sorted(entries_of(db, p.id), key=lambda e: e.week_starting)
    metrics = [Metric(**m) for m in p.agreement["metrics"]] if p.protocol == "operator_v1" else metrics_of(v)
    from types import SimpleNamespace
    milestones = list(v.milestones)
    if p.milestone_snapshot:
        milestones = []
        for raw in p.milestone_snapshot:
            data = dict(raw)
            for key in ("opened_at", "cleared_at", "missed_at"):
                if data.get(key):
                    data[key] = datetime.fromisoformat(data[key])
            milestones.append(SimpleNamespace(**data))
    vesting = db.scalars(select(VestingEntry).where(VestingEntry.pairing_id == p.id)).all()
    voided = db.scalars(select(VoidedTranche).where(VoidedTranche.pairing_id == p.id)).all()
    open_m = next((m for m in milestones if m.status == "open"), None)
    current_metric = next((m for m in metrics if open_m and m.key == open_m.metric_key), metrics[0] if metrics else None)
    revenue_metric = next((m for m in metrics if m.key == "revenue_php"), None) or next((m for m in metrics if m.unit == "php"), None)
    weeks = ledger_weeks(entries, week_start_of(p.started_at), now)
    ue, pt = v.unit_economics or {}, v.profitability_target or {}
    profit = profitability_progress(entries, metrics, ue.get("revenue_per_unit_php_monthly", 0), ue.get("variable_cost_per_unit_php_monthly", 0), pt.get("monthly_contribution_php", 0), now)
    day_count = max(0, ((p.ended_at or now) - p.started_at).days)
    proving_end = p.started_at + timedelta(days=p.proving_run_days)
    return {
        "pairing": p,
        "venture": v,
        "builder": builder,
        "counterpart": counterpart,
        "day_count": day_count,
        "proving_run_days_left": max(0, (proving_end - now).days) if p.state == "proving_run" else None,
        "milestones": [{"milestone": m, "deadline": dm.deadline_of(_state(m))} for m in milestones],
        "open_milestone": open_m,
        "cards": {
            "current": {"label": current_metric.label if current_metric else "Current", "value": aggregate(entries, current_metric) if current_metric else 0, "target": open_m.target_value if open_m else None, "unit": current_metric.unit if current_metric else "count"},
            "revenue": {"label": "Cumulative revenue", "value": aggregate(entries, revenue_metric) if revenue_metric else 0, "unit": "php"},
            "equity": {"vested_pct": round(sum(x.tranche_pct for x in vesting), 2), "on_offer_pct": dm.total_on_offer([_state(m) for m in milestones])},
            "profitability": profit,
        },
        "weeks": [{"week_starting": w, "entry_id": e.id if e else None, "values": e.values if e else None, "note": e.note if e else None, "closed": closed} for w, e, closed in weeks],
        "this_week": week_start_of(now),
        "vesting": vesting,
        "voided": voided,
    }

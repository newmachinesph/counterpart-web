"""The Counterpart logs weeks; the builder comments. Week-close immutability
is enforced in the domain."""
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.ledger import check_week_writable, validate_values
from app.models import LedgerComment, LedgerEntry, LedgerRevision, Pairing, User, Venture
from app.services.common import Forbidden, NotFound, Validation, new_id, now_utc
from app.services.pairings import assert_can_view, metrics_of, sync


def log_week(db: Session, user: User, p: Pairing, week_starting: date, values: dict, note: str, evidence_links: list[str], now: datetime | None = None) -> LedgerEntry:
    now = now or now_utc()
    assert_can_view(user, p)
    if p.counterpart_id != user.id:
        raise Forbidden("Only the Counterpart logs the ledger")
    db.refresh(p, with_for_update=True)
    from app.services.commercial import expire
    expire(db, p, now)
    if p.state not in ("proving_run", "active", "cofounder"):
        raise Validation("This pairing has ended. The ledger is closed.")
    v = db.get(Venture, p.venture_id)
    check_week_writable(week_starting, now)
    from app.domain.ledger import week_start_of
    if week_starting < week_start_of(p.started_at):
        raise Validation("A ledger week cannot precede the engagement")
    from app.domain.ledger import Metric
    metrics = [Metric(**m) for m in p.agreement["metrics"]] if p.protocol == "operator_v1" else metrics_of(v)
    validate_values(values, metrics)
    existing = db.scalar(select(LedgerEntry).where(LedgerEntry.pairing_id == p.id, LedgerEntry.week_starting == week_starting))
    if existing is not None:
        if not db.scalar(select(LedgerRevision.id).where(LedgerRevision.entry_id == existing.id).limit(1)):
            db.add(LedgerRevision(id=new_id("rev"), entry_id=existing.id, author_id=p.counterpart_id,
                snapshot={"values": dict(existing.values), "note": existing.note, "evidence_links": list(existing.evidence_links), "updated_at": existing.updated_at.isoformat()}, created_at=existing.updated_at))
        existing.values, existing.note, existing.evidence_links, existing.updated_at = dict(values), note, list(evidence_links), now
        entry = existing
    else:
        entry = LedgerEntry(id=new_id("le"), pairing_id=p.id, week_starting=week_starting, values=dict(values), note=note, evidence_links=list(evidence_links), submitted_at=now, updated_at=now)
        db.add(entry)
    db.flush()
    db.add(LedgerRevision(id=new_id("rev"), entry_id=entry.id, author_id=user.id,
        snapshot={"values": dict(values), "note": note, "evidence_links": list(evidence_links), "updated_at": now.isoformat()}, created_at=now))
    sync(db, p, now)
    db.commit()
    db.refresh(entry)
    return entry


def comment(db: Session, user: User, entry_id: str, body: str, now: datetime | None = None) -> LedgerComment:
    entry = db.get(LedgerEntry, entry_id)
    if entry is None:
        raise NotFound("Ledger entry not found")
    p = db.get(Pairing, entry.pairing_id)
    assert_can_view(user, p)
    if p.builder_id != user.id and "admin" not in user.roles:
        raise Forbidden("Only the builder comments on ledger entries")
    if not body.strip():
        raise Validation("Comment cannot be empty")
    c = LedgerComment(id=new_id("lc"), entry_id=entry.id, author_id=user.id, body=body.strip(), created_at=now or now_utc())
    db.add(c)
    db.commit()
    return c

"""Authorization-filtered read model for the server-rendered web application.

No client can write this snapshot. All commands use the domain service routes.
Private ledgers, applications, notifications and email addresses stay scoped to
their participants; published venture descriptions and aggregate counts are public.
"""
from fastapi import APIRouter, Depends, Header
from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.auth import current_user, optional_user
from app.accounts import token_hash
from app.db import get_db
from app.models import (Application, AuthSession, JobApplication, LedgerEntry, Milestone,
    Notification, Opening, OutboxEmail, Pairing, TermsTemplate, User, Venture, VestingEntry, VoidedTranche)
from app.schemas import LedgerEntryOut
from app.services import openings, pairings
from app.services.common import now_utc

router = APIRouter(tags=["workspace"])


def row(value):
    return {c.name: getattr(value, c.name) for c in value.__table__.columns}


@router.get("/workspace")
def workspace(user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    admin = bool(user and "admin" in user.roles)
    visible_pairings = pairings.list_for(db, user) if user else []
    pids = {p.id for p in visible_pairings}
    paired_vids = {p.venture_id for p in visible_pairings}
    all_ventures = db.scalars(select(Venture)).all()
    ventures = [v for v in all_ventures if v.status in ("published", "development") or admin or (user and v.builder_id == user.id) or v.id in paired_vids]
    vids = {v.id for v in ventures}
    managed = {v.id for v in ventures if admin or (user and v.builder_id == user.id)}
    apps = db.scalars(select(Application).where(Application.venture_id.in_(managed) | (Application.applicant_id == (user.id if user else "")))).all()
    ops = [o for o in db.scalars(select(Opening)).all() if o.venture_id is None or o.venture_id in vids]
    managed_ops = {o.id for o in ops if user and openings.can_manage_opening(db, user, o)}
    jobs = db.scalars(select(JobApplication).where(JobApplication.opening_id.in_(managed_ops) | (JobApplication.applicant_id == (user.id if user else "")))).all()
    private_users = ({user.id} if user else set()) | {a.applicant_id for a in apps} | {a.applicant_id for a in jobs}
    private_users |= {uid for p in visible_pairings for uid in (p.builder_id, p.counterpart_id)}
    public_users = {v.builder_id for v in ventures}
    users = []
    for u in db.scalars(select(User).where(User.id.in_(private_users | public_users))).all():
        data = row(u)
        if not admin and u.id not in private_users:
            data["email"] = ""
        users.append(data)
    app_counts = dict(db.execute(select(Application.venture_id, func.count()).group_by(Application.venture_id)).all())
    job_counts = dict(db.execute(select(JobApplication.opening_id, func.count()).group_by(JobApplication.opening_id)).all())
    return {
        "users": users,
        "ventures": [row(v) for v in ventures],
        "milestones": [row(m) for m in db.scalars(select(Milestone).where(Milestone.venture_id.in_(vids))).all()],
        "pairings": [row(p) for p in visible_pairings],
        "live_venture_ids": list(db.scalars(select(Pairing.venture_id).where(Pairing.state.in_(("offered", "active", "proving_run", "cofounder")))).all()),
        "completed_venture_ids": [],
        "ledger_entries": [LedgerEntryOut.model_validate(e).model_dump() for e in db.scalars(select(LedgerEntry).where(LedgerEntry.pairing_id.in_(pids))).all()],
        "vesting": [row(v) for v in db.scalars(select(VestingEntry).where(VestingEntry.pairing_id.in_(pids))).all()],
        "voided": [row(v) for v in db.scalars(select(VoidedTranche).where(VoidedTranche.pairing_id.in_(pids))).all()],
        "applications": [row(a) for a in apps],
        "openings": [row(o) for o in ops],
        "job_applications": [row(a) for a in jobs],
        "terms_templates": [row(t) for t in db.scalars(select(TermsTemplate)).all()],
        "notifications": [row(n) for n in db.scalars(select(Notification).where(Notification.user_id == (user.id if user else ""))).all()],
        "outbox": [row(e) for e in db.scalars(select(OutboxEmail)).all()] if admin else [],
        "applicant_counts": app_counts,
        "job_applicant_counts": job_counts,
        "ledger_revenue": {v.id: openings.ledger_revenue_for(db, v.id) for v in ventures},
    }


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return {
        "published": db.scalar(select(func.count()).select_from(Venture).where(Venture.status == "published")),
        "applications": db.scalar(select(func.count()).select_from(Application)),
        "pairings": db.scalar(select(func.count()).select_from(Pairing).where(Pairing.state.in_(("active", "proving_run")))),
        "weeks": db.scalar(select(func.count()).select_from(LedgerEntry)),
        "revenue": sum((e.values or {}).get("revenue_php", 0) for e in db.scalars(select(LedgerEntry)).all()),
        "vested": 0,  # Deprecated: percentages across companies are not additive.
        "equity_records": db.scalar(select(func.count()).select_from(VestingEntry)),
    }


@router.post("/notifications/read", status_code=204)
def read_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)).values(read_at=now_utc()))
    db.commit()


@router.post("/auth/logout", status_code=204)
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    token = (authorization or "").partition(" ")[2]
    session = db.get(AuthSession, token_hash(token)) if token else None
    if session:
        db.delete(session)
        db.commit()

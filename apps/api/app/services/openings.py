"""Openings service. Only someone who runs the venture may post for it, and a
role funded by the ledger is checked against what the ledger recorded."""
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.equity import revenue_run_rate
from app.domain.openings import validate_job_application, validate_opening
from app.models import JobApplication, LedgerEntry, Opening, Pairing, User, Venture
from app.services.common import Forbidden, NotFound, Validation, new_id, now_utc
from app.services.notifications import notify, send_email
from app.services.pairings import entries_of, metrics_of
from app.services.ventures import can_manage

LIVE = ("proving_run", "active", "cofounder")


def ledger_revenue_for(db: Session, venture_id: str | None, now: datetime | None = None) -> float:
    """Monthly revenue the venture's own ledger recorded in the last four weeks."""
    if venture_id is None:
        return 0.0
    v = db.get(Venture, venture_id)
    if v is None:
        return 0.0
    pairing_ids = [p.id for p in db.scalars(select(Pairing).where(Pairing.venture_id == venture_id)).all()]
    if not pairing_ids:
        return 0.0
    entries = []
    for pid in pairing_ids:
        entries.extend(entries_of(db, pid))
    php, _ = revenue_run_rate(entries, metrics_of(v), now or now_utc())
    return php


def can_post_for_venture(db: Session, user: User, v: Venture) -> bool:
    if can_manage(user, v):
        return True
    return db.scalar(
        select(Pairing.id).where(Pairing.venture_id == v.id, Pairing.counterpart_id == user.id, Pairing.state.in_(LIVE)).limit(1)
    ) is not None


def can_manage_opening(db: Session, user: User, o: Opening) -> bool:
    if o.venture_id is None:
        return "admin" in user.roles
    v = db.get(Venture, o.venture_id)
    return can_post_for_venture(db, user, v) if v else "admin" in user.roles


def postable_ventures(db: Session, user: User) -> list[Venture]:
    return [v for v in db.scalars(select(Venture).where(Venture.status == "published")).all() if can_post_for_venture(db, user, v)]


def _is_public(db: Session, o: Opening) -> bool:
    if o.venture_id is None:
        return True
    v = db.get(Venture, o.venture_id)
    return v is not None and v.status == "published"


def card(db: Session, o: Opening, now: datetime | None = None) -> dict:
    return {
        "opening": o,
        "venture": db.get(Venture, o.venture_id) if o.venture_id else None,
        "applicant_count": len(db.scalars(select(JobApplication.id).where(JobApplication.opening_id == o.id)).all()),
        "ledger_revenue_php": ledger_revenue_for(db, o.venture_id, now),
    }


def list_openings(db: Session, *, type: str | None = None, arrangement: str | None = None, venture_id: str | None = None, counterpart_only: bool = False, paid_only: bool = False, now: datetime | None = None) -> list[dict]:
    rows = db.scalars(select(Opening).where(Opening.status == "open")).all()
    out = [o for o in rows if _is_public(db, o)]
    if type:
        out = [o for o in out if o.type == type]
    if arrangement:
        out = [o for o in out if o.arrangement == arrangement]
    if venture_id:
        out = [o for o in out if o.venture_id == venture_id]
    if counterpart_only:
        out = [o for o in out if o.venture_id is None]
    if paid_only:
        out = [o for o in out if (o.salary_min_php_monthly or 0) > 0]
    # Counterpart's own roles first, then newest.
    out.sort(key=lambda o: (o.venture_id is not None, o.created_at.timestamp() * -1))
    return [card(db, o, now) for o in out]


def get_opening(db: Session, opening_id: str) -> Opening:
    o = db.get(Opening, opening_id)
    if o is None or not _is_public(db, o):
        raise NotFound("Opening not found")
    return o


def create_opening(db: Session, user: User, data: dict, now: datetime | None = None) -> Opening:
    from app.schemas import OpeningIn
    data = OpeningIn.model_validate(data).model_dump()
    now = now or now_utc()
    venture_id = data.get("venture_id") or None
    if venture_id is None:
        if "admin" not in user.roles:
            raise Forbidden("Only Counterpart admins post Counterpart roles")
    else:
        v = db.get(Venture, venture_id)
        if v is None:
            raise NotFound("Venture not found")
        if not can_post_for_venture(db, user, v):
            raise Forbidden("Only the builder or the Counterpart on this venture can post a role")
        if v.status != "published":
            raise Validation("Publish the venture before hiring for it")

    problem = validate_opening(
        venture_id=venture_id,
        title=data["title"],
        summary=data["summary"],
        responsibilities=data["responsibilities"],
        looking_for=data["looking_for"],
        salary_min=data.get("salary_min_php_monthly"),
        salary_max=data.get("salary_max_php_monthly"),
        equity_pct=data.get("equity_pct"),
        funded_by=data["funded_by"],
        ledger_revenue_php=ledger_revenue_for(db, venture_id, now),
    )
    if problem:
        raise Validation(problem)

    o = Opening(
        id=new_id("opn"), venture_id=venture_id, title=data["title"].strip(), team=data["team"].strip(),
        type=data["type"], arrangement=data["arrangement"], location=data["location"].strip(),
        summary=data["summary"].strip(), responsibilities=data["responsibilities"], looking_for=data["looking_for"],
        salary_min_php_monthly=data.get("salary_min_php_monthly"), salary_max_php_monthly=data.get("salary_max_php_monthly"),
        equity_pct=data.get("equity_pct"), funded_by=data["funded_by"], status="open",
        posted_by_id=user.id, created_at=now, closes_at=None,
        compensation_details=data["compensation_details"],
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


def set_status(db: Session, user: User, opening_id: str, status: str) -> Opening:
    o = db.get(Opening, opening_id)
    if o is None:
        raise NotFound("Opening not found")
    if not can_manage_opening(db, user, o):
        raise Forbidden("This role is not yours to manage")
    o.status = status
    db.commit()
    return o


def apply_to_opening(db: Session, user: User, opening_id: str, data: dict, now: datetime | None = None) -> JobApplication:
    now = now or now_utc()
    o = get_opening(db, opening_id)
    if can_manage_opening(db, user, o):
        raise Validation("You posted this role")
    if db.scalar(select(JobApplication.id).where(JobApplication.opening_id == o.id, JobApplication.applicant_id == user.id)):
        raise Validation("You have already applied to this role")
    problem = validate_job_application(
        evidence=data["evidence"], proof_links=data["proof_links"], why_this_role=data["why_this_role"],
        expected_salary=data.get("expected_salary_php_monthly"), opening_status=o.status,
    )
    if problem:
        raise Validation(problem)

    a = JobApplication(
        id=new_id("job"), opening_id=o.id, applicant_id=user.id, evidence=data["evidence"].strip(),
        proof_links=data["proof_links"], available_from=data["available_from"],
        expected_salary_php_monthly=data.get("expected_salary_php_monthly"), why_this_role=data["why_this_role"].strip(),
        status="submitted", submitted_at=now,
    )
    db.add(a)
    notify(db, o.posted_by_id, f"{user.name} applied for {o.title}.", f"/jobs/{o.id}/applicants")
    db.commit()
    return a


def list_applicants(db: Session, user: User, opening_id: str) -> list[JobApplication]:
    o = db.get(Opening, opening_id)
    if o is None:
        raise NotFound("Opening not found")
    if not can_manage_opening(db, user, o):
        raise Forbidden("This role is not yours to manage")
    return list(db.scalars(select(JobApplication).where(JobApplication.opening_id == opening_id).order_by(JobApplication.submitted_at.desc())).all())


def list_for_applicant(db: Session, user: User) -> list[JobApplication]:
    return list(db.scalars(select(JobApplication).where(JobApplication.applicant_id == user.id).order_by(JobApplication.submitted_at.desc())).all())


def review(db: Session, user: User, application_id: str, action: str, now: datetime | None = None) -> JobApplication:
    now = now or now_utc()
    a = db.get(JobApplication, application_id)
    if a is None:
        raise NotFound("Application not found")
    o = db.get(Opening, a.opening_id)
    if not can_manage_opening(db, user, o):
        raise Forbidden("This role is not yours to manage")
    if a.status in ("declined", "hired", "offered"):
        raise Validation(f"This application has already been {a.status}")
    applicant = db.get(User, a.applicant_id)

    a.status = {"shortlist": "shortlisted", "decline": "declined", "hire": "offered"}[action]
    a.decided_at = now
    if action == "decline":
        send_email(db, applicant.email, f"Your application for {o.title}", f"{applicant.name},\n\nThey have decided not to move forward for {o.title}.\n\nCounterpart")
    if action == "hire":
        from app.services.commercial import verified
        verified(user)
        db.refresh(o, with_for_update=True)
        if o.status != "open" or db.scalar(select(JobApplication.id).where(JobApplication.opening_id == o.id, JobApplication.status == "offered", JobApplication.id != a.id)):
            raise Validation("This role already has an offer pending or is closed")
        if not o.compensation_details or not o.salary_min_php_monthly:
            raise Validation("Publish a complete paid role before making an offer")
        a.offer_snapshot = {"title": o.title, "compensation_details": o.compensation_details,
            "salary_php_monthly": o.salary_min_php_monthly, "responsibilities": o.responsibilities,
            "employer_id": o.posted_by_id, "offered_at": now.isoformat(), "version": "job_v1"}
        from app.routers.commercial import hashlib_terms
        a.offer_snapshot = {**a.offer_snapshot, "hash": hashlib_terms(a.offer_snapshot)}
        notify(db, applicant.id, f"Review the offer for {o.title}. You have not accepted yet.", f"/jobs/{o.id}")
    db.commit()
    return a

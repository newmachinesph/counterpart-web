from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.domain.equity import validate_equity_request
from app.models import Application, Pairing, User, Venture
from app.services.common import Forbidden, NotFound, Validation, new_id, now_utc
from app.services.notifications import send_email
from app.services.pairings import sync
from app.services.commercial import make_offer
from app.services.ventures import assert_can_manage, has_live_pairing, has_completed_pairing, is_on_bench

MIN_EVIDENCE = 200


def submit(db: Session, user: User, v: Venture, data: dict, now: datetime | None = None) -> Application:
    now = now or now_utc()
    if "counterpart" not in user.roles:
        raise Forbidden("Only counterparts can apply")
    db.refresh(v, with_for_update=True)
    if not is_on_bench(db, v):
        raise Validation("This venture is not open for applications")
    if v.builder_id == user.id:
        raise Validation("You cannot apply to your own venture")
    if db.scalar(select(Application.id).where(Application.venture_id == v.id, Application.applicant_id == user.id)) is not None:
        raise Validation("You have already applied to this venture")
    if len(data["evidence"].strip()) < MIN_EVIDENCE:
        raise Validation(f"Evidence must be at least {MIN_EVIDENCE} characters")
    if not data["proof_links"]:
        raise Validation("At least one proof link is required")
    if not data["numbers_moved"]:
        raise Validation("Add at least one number you personally moved")
    if (v.status != "development" and not v.commercial_terms) or data.get("requested_equity_pct", 0) or data.get("track") == "intern":
        raise Validation("Apply to an agreed paid commercial role. Equity and internships require separate arrangements.")
    a = Application(
        id=new_id("app"), venture_id=v.id, applicant_id=user.id, evidence=data["evidence"].strip(), proof_links=data["proof_links"],
        numbers_moved=data["numbers_moved"], hours_per_week=data["hours_per_week"], compensation=data["compensation"], track=data["track"],
        requested_equity_pct=data["requested_equity_pct"], template_id=data["template_id"], commitments=data.get("commitments", []),
        acknowledges_resource_clause=data["acknowledges_resource_clause"], why_this_venture=data["why_this_venture"].strip(),
        status="submitted", submitted_at=now,
    )
    db.add(a)
    db.commit()
    return a


def list_for_venture(db: Session, user: User, v: Venture) -> list[Application]:
    assert_can_manage(user, v)
    return list(db.scalars(select(Application).where(Application.venture_id == v.id).order_by(Application.submitted_at.desc())).all())


def review(db: Session, user: User, application_id: str, action: str, now: datetime | None = None) -> Application:
    now = now or now_utc()
    a = db.get(Application, application_id)
    if a is None:
        raise NotFound("Application not found")
    v = db.get(Venture, a.venture_id)
    assert_can_manage(user, v)
    db.refresh(v, with_for_update=True)
    db.refresh(a)
    applicant = db.get(User, a.applicant_id)
    if a.status in ("declined", "invited"):
        raise Validation(f"This application has already been {a.status}")
    if action == "shortlist":
        a.status, a.decided_at = "shortlisted", now
    elif action == "decline":
        a.status, a.decided_at = "declined", now
        send_email(db, applicant.email, f"Your application to {v.name}", f"{applicant.name},\n\n{v.name} has decided not to move forward with your application. The builder read it and chose someone else for this venture.\n\nYour application stays on file. Other ventures on the Bench are open now.\n\nCounterpart")
    elif action == "invite":
        if has_live_pairing(db, v.id):
            raise Validation("This venture already has a live pairing")
        p = make_offer(db, v, a, db.get(User, v.builder_id), applicant, now)
        a.status, a.decided_at = "invited", now
        db.flush()
        send_email(db, applicant.email, f"{v.name}: review your commercial offer", f"{applicant.name},\n\nReview the saved agreement in your Pairings page. Work starts only after you accept. This offer grants no equity.\n\nCounterpart")
    else:
        raise Validation("Unknown action")
    db.commit()
    return a

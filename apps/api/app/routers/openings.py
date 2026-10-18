from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import User
from app.schemas import JobApplicationIn, JobApplicationOut, JobReviewIn, OpeningCardOut, OpeningIn, OpeningOut, OpeningStatusIn
from app.services import openings as svc

router = APIRouter(tags=["jobs"])


@router.get("/jobs", response_model=list[OpeningCardOut])
def board(type: str | None = None, arrangement: str | None = None, venture_id: str | None = None, counterpart_only: bool = False, paid_only: bool = False, db: Session = Depends(get_db)):
    return svc.list_openings(db, type=type, arrangement=arrangement, venture_id=venture_id, counterpart_only=counterpart_only, paid_only=paid_only)


@router.get("/jobs/{opening_id}", response_model=OpeningCardOut)
def detail(opening_id: str, db: Session = Depends(get_db)):
    return svc.card(db, svc.get_opening(db, opening_id))


@router.post("/jobs", response_model=OpeningOut, status_code=201)
def post_role(body: OpeningIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.create_opening(db, user, body.model_dump())


@router.post("/jobs/{opening_id}/status", response_model=OpeningOut)
def set_status(opening_id: str, body: OpeningStatusIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.set_status(db, user, opening_id, body.status)


@router.post("/jobs/{opening_id}/applications", response_model=JobApplicationOut, status_code=201)
def apply(opening_id: str, body: JobApplicationIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.apply_to_opening(db, user, opening_id, body.model_dump())


@router.get("/jobs/{opening_id}/applications", response_model=list[JobApplicationOut])
def applicants(opening_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.list_applicants(db, user, opening_id)


@router.get("/my/job-applications", response_model=list[JobApplicationOut])
def mine(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.list_for_applicant(db, user)


@router.post("/job-applications/{application_id}/review", response_model=JobApplicationOut)
def review(application_id: str, body: JobReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.review(db, user, application_id, body.action)


@router.post("/job-applications/{application_id}/respond")
def respond(application_id: str, body: JobReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from app.models import JobApplication, Opening
    from app.services.common import Validation, Forbidden, NotFound, now_utc
    from app.services.commercial import verified
    a = db.get(JobApplication, application_id)
    if not a:
        raise NotFound("Application")
    if a.applicant_id != user.id:
        raise Forbidden("Only the applicant can respond")
    o = db.get(Opening, a.opening_id)
    db.refresh(o, with_for_update=True)
    db.refresh(a, with_for_update=True)
    if a.status != "offered" or o.status != "open" or body.action not in ("hire", "decline"):
        raise Validation("This offer is no longer available")
    if body.action == "hire":
        verified(user)
        from datetime import datetime, timedelta
        if not a.offer_snapshot or body.agreement_hash != a.offer_snapshot.get("hash") or now_utc() >= datetime.fromisoformat(a.offer_snapshot["offered_at"]) + timedelta(days=14):
            raise Validation("Confirm the exact saved offer within 14 days")
        a.status, o.status = "hired", "filled"
    else:
        a.status = "declined"
    a.decided_at = now_utc()
    db.commit()
    return {"status": a.status}

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import User, Milestone
from app.schemas import CommentIn, CommentOut, DashboardOut, EndIn, LedgerEntryIn, LedgerEntryOut, PairingOut, ReviewRequestIn
from app.services import ledger as ledger_svc
from app.services import pairings as svc

router = APIRouter(tags=["pairings"])


@router.get("/pairings", response_model=list[PairingOut])
def mine(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.list_for(db, user)


@router.get("/pairings/{pairing_id}", response_model=DashboardOut)
def dashboard(pairing_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = svc.get(db, pairing_id)
    svc.assert_can_view(user, p)
    d = svc.dashboard(db, user, p)
    d["milestones"] = [{"milestone": {c.name: getattr(m["milestone"], c.name) for c in Milestone.__table__.columns}, "deadline": m["deadline"]} for m in d["milestones"]]
    return d


@router.post("/pairings/{pairing_id}/ledger", response_model=LedgerEntryOut)
def log_week(pairing_id: str, body: LedgerEntryIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = svc.get(db, pairing_id)
    return ledger_svc.log_week(db, user, p, body.week_starting, body.values, body.note, body.evidence_links)


@router.post("/ledger/{entry_id}/comments", response_model=CommentOut, status_code=201)
def comment(entry_id: str, body: CommentIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return ledger_svc.comment(db, user, entry_id, body.body)


@router.post("/pairings/{pairing_id}/end", response_model=PairingOut)
def end(pairing_id: str, body: EndIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return svc.end(db, user, svc.get(db, pairing_id), body.reason)


@router.post("/pairings/{pairing_id}/review-request", status_code=204)
def review_request(pairing_id: str, body: ReviewRequestIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    svc.request_review(db, user, svc.get(db, pairing_id), body.message)
    return None

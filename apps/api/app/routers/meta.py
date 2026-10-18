from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.domain.equity import EQUITY_CAP_PCT, RESOURCE_CLAUSE, RESOURCE_CLAUSE_PCT, TEMPLATES
from app.models import Notification, User
from app.schemas import NotificationOut, UserOut

router = APIRouter(tags=["meta"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc())).all()


@router.get("/equity/templates")
def templates():
    return {"cap_pct": EQUITY_CAP_PCT, "resource_clause_pct": RESOURCE_CLAUSE_PCT, "resource_clause": RESOURCE_CLAUSE, "templates": [asdict(t) for t in TEMPLATES]}

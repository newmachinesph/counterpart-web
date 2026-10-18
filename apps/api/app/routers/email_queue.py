from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_role
from app.db import get_db
from app.models import OutboxEmail, User
from app.services.common import now_utc
from app.services.notifications import send_email

router = APIRouter(prefix="/admin/email-queue", tags=["email queue"])


def output(message):
    state = "delivered" if message.delivered_at else "failed" if message.attempts >= 10 else "cancelled" if message.dispatch_after is None else "scheduled" if message.dispatch_after > now_utc() else "queued"
    return {"id": message.id, "to": message.to, "subject": message.subject, "status": state,
        "attempts": message.attempts, "send_at": message.dispatch_after, "delivered_at": message.delivered_at, "last_error": message.last_error}


class EmailIn(BaseModel):
    to: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$")
    subject: str = Field(min_length=1, max_length=200, pattern=r"^[^\r\n]+$")
    body: str = Field(min_length=1, max_length=50000)
    send_at: datetime | None = None

    @field_validator("send_at")
    @classmethod
    def aware(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("Include a timezone in the scheduled time")
        return value


@router.get("")
def queue(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return [output(m) for m in db.scalars(select(OutboxEmail).order_by(OutboxEmail.sent_at.desc()).limit(100))]


@router.post("", status_code=201)
def schedule(body: EmailIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    message = send_email(db, body.to, body.subject, body.body, send_at=body.send_at)
    db.commit()
    return output(message)


@router.post("/{message_id}/{action}")
def control(message_id: str, action: str, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    message = db.scalar(select(OutboxEmail).where(OutboxEmail.id == message_id).with_for_update())
    if not message:
        raise HTTPException(404, "Email not found")
    if message.delivered_at:
        raise HTTPException(409, "This email was already delivered")
    if action == "retry":
        message.attempts, message.last_error, message.dispatch_after = 0, None, now_utc()
    elif action == "cancel":
        message.dispatch_after = None
    else:
        raise HTTPException(404, "Unknown queue action")
    db.commit()
    return output(message)

from datetime import datetime
from sqlalchemy.orm import Session

from app.models import Notification, OutboxEmail
from app.services.common import new_id, now_utc
from app.services.realtime import channel, enqueue


def notify(db: Session, user_id: str, body: str, href: str | None = None) -> None:
    identifier = new_id("ntf")
    db.add(Notification(id=identifier, user_id=user_id, body=body, href=href, created_at=now_utc()))
    enqueue(db, channel("user", user_id), "notification.created", {"notification_id": identifier})


def send_email(db: Session, to: str, subject: str, body: str, *, send_at: datetime | None = None) -> OutboxEmail:
    if send_at is not None and send_at.tzinfo is None:
        raise ValueError("Scheduled delivery requires a timezone")
    message = OutboxEmail(id=new_id("mail"), to=to, subject=subject, body=body,
        sent_at=now_utc(), dispatch_after=send_at or now_utc())
    db.add(message)
    return message

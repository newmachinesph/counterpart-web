from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import ChatMessage, Pairing, User
from app.services import rate_limit, realtime
from app.services.common import Forbidden, NotFound, Validation, new_id, now_utc

router = APIRouter(tags=["chat"])


def participant(db: Session, user: User, pairing_id: str) -> Pairing:
    pairing = db.get(Pairing, pairing_id)
    if not pairing:
        raise NotFound("Pairing")
    if user.id not in (pairing.builder_id, pairing.counterpart_id) and "admin" not in user.roles:
        raise Forbidden("Chat is private to this pairing's participants and administrators")
    return pairing


def message_out(db: Session, message: ChatMessage):
    author = db.get(User, message.author_id)
    return {"id": message.id, "author_id": message.author_id, "author_name": author.name,
            "body": message.body, "created_at": message.created_at, "client_id": message.client_id}


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    client_id: str = Field(min_length=8, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")


class TokenIn(BaseModel):
    pairing_id: str | None = None


@router.post("/realtime/token")
def auth_token(body: TokenIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    targets = [realtime.channel("user", user.id)]
    if body.pairing_id:
        participant(db, user, body.pairing_id)
        targets.append(realtime.channel("pairing", body.pairing_id))
    rate_limit.check("realtime", user.id, 30)
    return {"token_details": realtime.token_request(user.id, targets), "channels": targets}


@router.get("/pairings/{pairing_id}/messages")
def messages(pairing_id: str, before: str | None = None, limit: int = Query(default=50, ge=1, le=100),
             user: User = Depends(current_user), db: Session = Depends(get_db)):
    pairing = participant(db, user, pairing_id)
    query = select(ChatMessage).where(ChatMessage.pairing_id == pairing_id)
    if before:
        try:
            timestamp, identifier = before.split("|", 1)
            at = datetime.fromisoformat(timestamp)
            if at.tzinfo is None or not identifier:
                raise ValueError()
        except ValueError:
            raise Validation("Invalid message cursor")
        query = query.where(or_(ChatMessage.created_at < at, and_(ChatMessage.created_at == at, ChatMessage.id < identifier)))
    rows = list(db.scalars(query.order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(limit + 1)).all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    return {"messages": [message_out(db, m) for m in reversed(rows)], "has_more": has_more,
            "next_before": f"{rows[-1].created_at.isoformat()}|{rows[-1].id}" if has_more else None,
            "channel": realtime.channel("pairing", pairing_id), "read_only": pairing.state not in ("active", "proving_run", "cofounder")}


@router.post("/pairings/{pairing_id}/messages", status_code=201)
def send_message(pairing_id: str, body: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    pairing = participant(db, user, pairing_id)
    db.refresh(pairing, with_for_update=True)
    existing = db.scalar(select(ChatMessage).where(ChatMessage.pairing_id == pairing_id,
        ChatMessage.author_id == user.id, ChatMessage.client_id == body.client_id))
    if existing:
        return message_out(db, existing)
    if pairing.state not in ("active", "proving_run", "cofounder"):
        raise Validation("This pairing has ended. Its conversation is now read-only.")
    if not body.body.strip():
        raise Validation("Write a message first")
    rate_limit.check("chat", user.id, 40)
    message = ChatMessage(id=new_id("msg"), pairing_id=pairing_id, author_id=user.id,
                          client_id=body.client_id, body=body.body.strip(), created_at=now_utc())
    db.add(message)
    realtime.enqueue(db, realtime.channel("pairing", pairing_id), "message.created", {"message_id": message.id})
    db.commit()
    return message_out(db, message)

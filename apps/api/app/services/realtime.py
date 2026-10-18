import json
import secrets
import time
from datetime import timedelta
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import RealtimeEvent
from app.services.common import new_id, now_utc


def channel(kind: str, identifier: str) -> str:
    return f"counterpart:{settings.app_env}:{kind}:{identifier}"


def enqueue(db: Session, target: str, name: str, payload: dict) -> None:
    db.add(RealtimeEvent(id=new_id("evt"), channel=target, name=name, payload=payload,
                         created_at=now_utc(), dispatch_after=now_utc()))


def token_request(user_id: str, channels: list[str]) -> dict:
    if not settings.ably_api_key:
        raise HTTPException(503, "Live updates are not configured. Messages remain available on refresh.")
    try:
        key_name, secret = settings.ably_api_key.split(":", 1)
        response = httpx.post(f"https://main.realtime.ably.net/keys/{quote(key_name, safe='')}/requestToken",
            auth=(key_name, secret), json={"keyName": key_name, "clientId": user_id, "ttl": 900000,
            "timestamp": int(time.time() * 1000), "nonce": secrets.token_hex(16),
            "capability": json.dumps({name: ["subscribe"] for name in channels}, sort_keys=True, separators=(",", ":"))}, timeout=10)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Live updates are temporarily unavailable. You can still send and refresh messages.")


def dispatch_one(db: Session) -> bool:
    if not settings.ably_api_key:
        return False
    event = db.scalar(select(RealtimeEvent).where(RealtimeEvent.delivered_at.is_(None),
        RealtimeEvent.dispatch_after <= now_utc(), RealtimeEvent.attempts < 20)
        .order_by(RealtimeEvent.created_at).limit(1).with_for_update(skip_locked=True))
    if not event:
        db.rollback()
        return False
    event.attempts += 1
    try:
        key_name, secret = settings.ably_api_key.split(":", 1)
        response = httpx.post(f"https://main.realtime.ably.net/channels/{quote(event.channel, safe='')}/messages",
            auth=(key_name, secret), json={"id": event.id, "name": event.name, "data": event.payload}, timeout=10)
        response.raise_for_status()
        event.delivered_at = now_utc()
    except (httpx.HTTPError, ValueError):
        event.dispatch_after = now_utc() + timedelta(seconds=min(300, 2 ** event.attempts))
    db.commit()
    return True

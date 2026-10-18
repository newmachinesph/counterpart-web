import hashlib
import hmac
import json
import time
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.models import User, VerificationSession, WebhookReceipt
from app.services.common import now_utc
from app.services.notifications import notify
from app.services.rate_limit import check

router = APIRouter(tags=["verification"])
STATUSES = {"Not Started", "In Progress", "Approved", "Declined", "In Review", "Abandoned", "Expired", "Kyc Expired", "Resubmitted"}


def public_session(session):
    return {"id": session.id, "status": session.status, "url": session.url, "updated_at": session.updated_at} if session else None


@router.get("/verification")
def verification(user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.scalar(select(VerificationSession).where(VerificationSession.user_id == user.id).order_by(VerificationSession.created_at.desc()).limit(1))
    return {"optional": True, "configured": bool(settings.verification_enabled and settings.didit_api_key and settings.didit_workflow_id), "session": public_session(session)}


@router.post("/verification/start", status_code=201)
def start(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not settings.verification_enabled or not settings.didit_api_key or not settings.didit_workflow_id:
        raise HTTPException(503, "Identity verification is not configured yet. You can continue using Counterpart.")
    check("verification", user.id, 3, 3600)
    db.refresh(user, with_for_update=True)
    previous = db.scalar(select(VerificationSession).where(VerificationSession.user_id == user.id).order_by(VerificationSession.created_at.desc()).limit(1))
    if previous and previous.status in ("Not Started", "In Progress", "In Review", "Approved", "Resubmitted"):
        return public_session(previous)
    try:
        response = httpx.post("https://verification.didit.me/v3/session/",
            headers={"x-api-key": settings.didit_api_key}, json={"workflow_id": settings.didit_workflow_id,
            "vendor_data": user.id, "callback": settings.web_url + "/settings/verification", "callback_method": "both"}, timeout=15)
        response.raise_for_status()
        data = response.json()
        parsed = urlsplit(data["url"])
        if parsed.scheme != "https" or not (parsed.hostname == "didit.me" or (parsed.hostname or "").endswith(".didit.me")):
            raise ValueError()
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, "Verification could not start. Please try again later.")
    session = VerificationSession(id=data["session_id"], user_id=user.id, status=data.get("status", "Not Started"),
        url=data["url"], workflow_id=settings.didit_workflow_id, created_at=now_utc(), updated_at=now_utc())
    db.add(session)
    db.commit()
    return public_session(session)


def canonical(value):
    if isinstance(value, dict):
        return {key: canonical(child) for key, child in value.items()}
    if isinstance(value, list):
        return [canonical(child) for child in value]
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


@router.post("/webhooks/didit")
async def webhook(request: Request, db: Session = Depends(get_db)):
    secret = settings.didit_webhook_secret
    if not secret:
        raise HTTPException(503, "Webhook is not configured")
    raw = await request.body()
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(413, "Payload too large")
    try:
        data = json.loads(raw)
        timestamp = int(request.headers.get("x-timestamp", "0"))
        if abs(time.time() - timestamp) > 300 or int(data["timestamp"]) != timestamp:
            raise ValueError()
        body = json.dumps(canonical(data), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, request.headers.get("x-signature-v2", "")):
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(401, "Invalid webhook signature")
    if data.get("webhook_type") not in ("status.updated", "data.updated"):
        return {"ok": True}
    session = db.get(VerificationSession, data.get("session_id", ""))
    if not session:
        return {"ok": True}
    db.refresh(session, with_for_update=True)
    if data.get("vendor_data") != session.user_id or data.get("workflow_id") != session.workflow_id:
        raise HTTPException(400, "Session metadata mismatch")
    event_id = "didit:" + hashlib.sha256(str(data.get("event_id") or hashlib.sha256(raw).hexdigest()).encode()).hexdigest()
    if db.get(WebhookReceipt, event_id):
        return {"ok": True}
    status = data.get("status")
    if status not in STATUSES:
        raise HTTPException(400, "Unknown verification status")
    try:
        changed_at = int(data.get("created_at", timestamp))
    except (TypeError, ValueError):
        raise HTTPException(400, "Invalid event timestamp")
    if changed_at >= session.provider_updated_at:
        session.provider_updated_at = changed_at
        if session.status != status:
            session.status, session.updated_at = status, now_utc()
            notify(db, session.user_id, f"Your optional identity verification is now {status.lower()}.", "/settings/verification")
    db.add(WebhookReceipt(id=event_id, provider="didit", received_at=now_utc()))
    db.commit()
    return {"ok": True}

"""Authenticated, retry-safe lifecycle maintenance for QStash schedules."""
import base64
import hashlib
import hmac

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Pairing, WebhookReceipt
from app.services.common import now_utc
from app.services.pairings import sync

router = APIRouter(tags=["jobs"])


def verify(signature: str, raw: bytes) -> dict:
    target = settings.qstash_callback_url or settings.public_api_url + "/webhooks/qstash/maintenance"
    for key in (settings.qstash_current_signing_key, settings.qstash_next_signing_key):
        if not key:
            continue
        try:
            claims = jwt.decode(signature, key, algorithms=["HS256"], issuer="Upstash",
                options={"require": ["iss", "sub", "exp", "nbf", "body", "jti"]})
            digest = base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).decode().rstrip("=")
            if claims["sub"] == target and hmac.compare_digest(digest, str(claims["body"]).rstrip("=")):
                return claims
        except jwt.InvalidTokenError:
            continue
    raise HTTPException(401, "Invalid job signature")


@router.post("/webhooks/qstash/maintenance")
async def maintenance(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    if len(raw) > 4096:
        raise HTTPException(413, "Payload too large")
    claims = verify(request.headers.get("upstash-signature", ""), raw)
    identifier = "qstash:" + hashlib.sha256(str(claims["jti"]).encode()).hexdigest()
    if db.get(WebhookReceipt, identifier):
        return {"ok": True, "duplicate": True}
    # Each pairing is independently locked and committed by the domain service.
    # A retried or overlapping job cannot vest a tranche twice.
    ids = list(db.scalars(select(Pairing.id).where(Pairing.state.in_(["offered", "active", "proving_run", "cofounder"]))).all())
    for pairing_id in ids:
        sync(db, db.get(Pairing, pairing_id))
    from datetime import timedelta
    from app.models import JobApplication
    from app.services.notifications import notify
    for offer in db.scalars(select(JobApplication).where(JobApplication.status == "offered", JobApplication.decided_at <= now_utc() - timedelta(days=14)).with_for_update()):
        offer.status = "declined"
        notify(db, offer.applicant_id, "The unanswered job offer expired after 14 days. Its saved terms remain in your application record.", f"/jobs/{offer.opening_id}")
    from sqlalchemy.dialects.postgresql import insert
    db.execute(insert(WebhookReceipt).values(id=identifier, provider="qstash", received_at=now_utc()).on_conflict_do_nothing())
    db.commit()
    return {"ok": True, "pairings_checked": len(ids)}

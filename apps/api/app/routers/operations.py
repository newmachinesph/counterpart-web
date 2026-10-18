from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.db import get_db
from app.models import User, Venture, Pairing, ReviewCase, OutboxEmail
from app.services.common import NotFound, Validation, new_id, now_utc
from app.services import operations
from app.services.rate_limit import check

router = APIRouter(tags=["operations"])
admin = require_role("admin")


def public_case(row):
    return {key: getattr(row, key) for key in (
        "id", "category", "subject", "message", "status", "resolution", "created_at", "resolved_at", "pairing_id",
    )}


def case_details(db, row):
    reporter = db.get(User, row.opened_by)
    owner = db.get(User, row.assigned_to) if row.assigned_to else None
    pairing = db.get(Pairing, row.pairing_id) if row.pairing_id else None
    venture_id = row.venture_id or (pairing.venture_id if pairing else None)
    venture = db.get(Venture, venture_id) if venture_id else None
    return {**public_case(row), "version": row.version, "assigned_to": row.assigned_to,
        "reporter": {"id": reporter.id, "name": reporter.name, "email": reporter.email},
        "owner_name": owner.name if owner else None,
        "venture": {"id": venture.id, "name": venture.name, "slug": venture.slug, "status": venture.status} if venture else None,
    }


@router.get("/admin/overview")
def overview(user: User = Depends(admin), db: Session = Depends(get_db)):
    active = ReviewCase.status.in_(("open", "in_review"))
    def count(*conditions):
        return db.scalar(select(func.count()).select_from(ReviewCase).where(*conditions))
    return {
        "open_cases": count(active), "unassigned_cases": count(active, ReviewCase.assigned_to.is_(None)),
        "older_cases": count(active, ReviewCase.created_at < now_utc() - timedelta(days=3)),
        "my_cases": count(active, ReviewCase.assigned_to == user.id),
        "email_failures": db.scalar(select(func.count()).select_from(OutboxEmail).where(
            OutboxEmail.delivered_at.is_(None), OutboxEmail.last_error.is_not(None), OutboxEmail.dispatch_after.is_not(None))),
        "categories": {kind: count(active, ReviewCase.category == kind) for kind in ("support", "listing", "account", "dispute")},
        "admins": [{"id": u.id, "name": u.name} for u in db.scalars(select(User).order_by(User.name)) if "admin" in u.roles],
    }


@router.get("/admin/cases")
def cases(status: Literal["active", "open", "in_review", "resolved", "all"] = "active",
          category: Literal["all", "support", "listing", "account", "dispute"] = "all",
          owner: Literal["all", "mine", "unassigned"] = "all",
          q: str = Query(default="", max_length=120), offset: int = Query(default=0, ge=0),
          user: User = Depends(admin), db: Session = Depends(get_db)):
    conditions = []
    if status == "active":
        conditions.append(ReviewCase.status.in_(("open", "in_review")))
    elif status != "all":
        conditions.append(ReviewCase.status == status)
    if category != "all":
        conditions.append(ReviewCase.category == category)
    if owner != "all":
        conditions.append(ReviewCase.assigned_to == user.id if owner == "mine" else ReviewCase.assigned_to.is_(None))
    if q.strip():
        term = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append(or_(ReviewCase.subject.ilike(f"%{term}%", escape="\\"), ReviewCase.id.ilike(f"%{term}%", escape="\\")))
    total = db.scalar(select(func.count()).select_from(ReviewCase).where(*conditions))
    rows = db.scalars(select(ReviewCase).where(*conditions).order_by(ReviewCase.created_at, ReviewCase.id).offset(offset).limit(25))
    return {"items": [case_details(db, row) for row in rows], "total": total, "offset": offset, "limit": 25}


@router.get("/admin/cases/{identifier}")
def case(identifier: str, user: User = Depends(admin), db: Session = Depends(get_db)):
    row = db.get(ReviewCase, identifier)
    if not row:
        raise NotFound("Case not found")
    events = []
    for event in row.events:
        actor = db.get(User, event["actor"])
        owner = db.get(User, event.get("assigned_to")) if event.get("assigned_to") else None
        events.append({**event, "actor_name": actor.name if actor else "Former administrator", "owner_name": owner.name if owner else None})
    return {**case_details(db, row), "events": events}


class CaseAction(BaseModel):
    action: Literal["assign", "start", "note", "resolve", "reopen", "hide_listing", "restore_listing"]
    version: int = Field(ge=0)
    assigned_to: str | None = Field(default=None, max_length=40)
    note: str = Field(default="", max_length=3000)


@router.post("/admin/cases/{identifier}")
def update_case(identifier: str, body: CaseAction, user: User = Depends(admin), db: Session = Depends(get_db)):
    row = db.scalar(select(ReviewCase).where(ReviewCase.id == identifier).with_for_update())
    if not row:
        raise NotFound("Case not found")
    operations.update(db, row, user, body)
    db.commit()
    return {"id": row.id, "version": row.version, "status": row.status}


class SupportIn(BaseModel):
    category: Literal["support", "listing", "account"]
    subject: str = Field(min_length=5, max_length=160)
    message: str = Field(min_length=20, max_length=5000)
    venture_slug: str | None = Field(default=None, max_length=80)

    @field_validator("subject", "message", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value


@router.post("/support/requests", status_code=201)
def create_request(body: SupportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    check("support", user.id, 10, 3600)
    venture = None
    if body.category == "listing":
        venture = db.scalar(select(Venture).where(Venture.slug == body.venture_slug))
        if not venture or (venture.status not in ("published", "development") and venture.builder_id != user.id and "admin" not in user.roles):
            raise NotFound("Listing not found")
    elif body.venture_slug:
        raise Validation("Only listing reports can reference a venture")
    row = ReviewCase(id=new_id("case"), category=body.category, subject=body.subject, message=body.message,
        opened_by=user.id, venture_id=venture.id if venture else None, status="open", created_at=now_utc())
    db.add(row)
    db.commit()
    return public_case(row)


@router.get("/support/requests")
def my_requests(offset: int = Query(default=0, ge=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    conditions = (ReviewCase.opened_by == user.id, ReviewCase.category != "dispute")
    rows = db.scalars(select(ReviewCase).where(*conditions).order_by(ReviewCase.created_at.desc(), ReviewCase.id).offset(offset).limit(20))
    return {"items": [public_case(row) for row in rows],
        "total": db.scalar(select(func.count()).select_from(ReviewCase).where(*conditions)), "offset": offset, "limit": 20}

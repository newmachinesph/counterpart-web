from datetime import datetime, timedelta, timezone
from decimal import Decimal
from calendar import monthrange
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.auth import current_user
from app.db import get_db
from app.domain.contracts import money, monthly_fee, vested_units
from app.models import User, Pairing, Venture, CommercialDeal, CompensationClaim, EquityGrant, ReviewCase, LedgerRevision, LedgerEntry, VestingEntry
from app.services import pairings, commercial
from app.services.common import Validation, Forbidden, NotFound, new_id, now_utc
from app.services.notifications import notify

router = APIRouter(tags=["commercial agreements"])


def party(db, user, identifier, lock=False):
    p = pairings.get(db, identifier)
    pairings.assert_is_party(user, p)
    if lock:
        db.refresh(p, with_for_update=True)
    return p


def output(row):
    return {c.name: str(value) if isinstance(value, Decimal) else value for c in row.__table__.columns
        if not (isinstance(row, ReviewCase) and c.name == "events") for value in [getattr(row, c.name)]}


class Action(BaseModel):
    action: str
    agreement_hash: str = ""
    note: str = Field(default="", max_length=3000)


@router.post("/pairings/{identifier}/agreement")
def agreement_action(identifier: str, body: Action, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return output(commercial.action(db, party(db, user, identifier), user, body.action, body.agreement_hash))


@router.get("/pairings/{identifier}/commercial")
def details(identifier: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = party(db, user, identifier)
    cutoff = commercial.effective_end(p)
    grants = []
    for grant in db.scalars(select(EquityGrant).where(EquityGrant.pairing_id == p.id)).all():
        row = output(grant)
        row["vested_units"] = vested_units(grant.terms, min(now_utc(), cutoff) if cutoff else now_utc()) if grant.status == "accepted" else 0
        grants.append(row)
    return {"pairing": output(p), "effective_end": cutoff if cutoff and cutoff.year < 9999 else None,
        "deals": [output(r) for r in db.scalars(select(CommercialDeal).where(CommercialDeal.pairing_id == p.id)).all()],
        "claims": [output(r) for r in db.scalars(select(CompensationClaim).where(CompensationClaim.pairing_id == p.id).order_by(CompensationClaim.created_at)).all()],
        "cases": [output(r) for r in db.scalars(select(ReviewCase).where(ReviewCase.pairing_id == p.id)).all()],
        "revisions": [output(r) for r in db.scalars(select(LedgerRevision).join(LedgerEntry).where(LedgerEntry.pairing_id == p.id).order_by(LedgerRevision.created_at)).all()],
        "grants": grants}


class DealIn(BaseModel):
    reference: str = Field(min_length=3, max_length=120)
    evidence: str = Field(min_length=10, max_length=3000)


@router.post("/pairings/{identifier}/deals", status_code=201)
def register_deal(identifier: str, body: DealIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = party(db, user, identifier, True)
    now = now_utc()
    if p.protocol != "operator_v1" or user.id != p.counterpart_id or not p.accepted_at or now >= commercial.effective_end(p):
        raise Validation("Only the operator can register deals during an accepted engagement")
    reference = body.reference.strip()
    if db.scalar(select(CommercialDeal.id).where(CommercialDeal.pairing_id == p.id, CommercialDeal.reference == reference)):
        raise Validation("This deal reference is already registered")
    row = CommercialDeal(id=new_id("deal"), pairing_id=p.id, reference=reference, evidence=body.evidence, registered_at=now)
    db.add(row)
    db.commit()
    return output(row)


class ClaimIn(BaseModel):
    kind: str = Field(pattern=r"^(commission|fee)$")
    reference: str = Field(min_length=3, max_length=100)
    deal_id: str | None = None
    collected_at: datetime | None = None
    eligible_revenue_php: Decimal = Field(default=Decimal(0), ge=0, le=1000000000, decimal_places=2)
    evidence: str = Field(min_length=10, max_length=5000)
    fee_month: str | None = Field(default=None, pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")

    @field_validator("collected_at")
    @classmethod
    def aware(cls, value):
        if value and value.tzinfo is None:
            raise ValueError("Include the collection timezone")
        return value


@router.post("/pairings/{identifier}/claims", status_code=201)
def submit_claim(identifier: str, body: ClaimIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = party(db, user, identifier, True)
    if p.protocol != "operator_v1" or not p.accepted_at or user.id != p.counterpart_id:
        raise Validation("Claims require an accepted commercial agreement and its operator")
    terms, now = p.agreement["terms"], now_utc()
    cutoff = commercial.effective_end(p)
    reference, collected, deal = body.reference.strip(), body.collected_at, None
    if body.kind == "commission":
        deal = db.get(CommercialDeal, body.deal_id or "")
        if not deal or deal.pairing_id != p.id or deal.registered_at >= cutoff:
            raise Validation("Choose an eligible deal registered before departure")
        if not collected or collected < deal.registered_at or collected > now or collected > cutoff + timedelta(days=terms["tail_days"]):
            raise Validation("Collection must follow registration and fall inside the agreed engagement or pipeline tail")
        amount = money(body.eligible_revenue_php * Decimal(str(terms["commission_rate_pct"])) / 100)
    else:
        if not body.fee_month:
            raise Validation("Select the fee month")
        year, month = map(int, body.fee_month.split("-"))
        month_end = datetime(year, month, 1, tzinfo=timezone.utc) + timedelta(days=monthrange(year, month)[1])
        collected = min(month_end, cutoff)
        if now < collected:
            raise Validation("Claim the monthly fee after that month or the engagement ends")
        amount = monthly_fee(terms, p.started_at, cutoff, year, month)
        reference = "fee:" + body.fee_month
    if amount <= 0:
        raise Validation("There is no positive compensation due for this claim")
    if db.scalar(select(CompensationClaim.id).where(CompensationClaim.pairing_id == p.id, CompensationClaim.reference == reference)):
        raise Validation("This receipt or fee month already has a claim")
    row = CompensationClaim(id=new_id("claim"), pairing_id=p.id, deal_id=deal.id if deal else None,
        kind=body.kind, reference=reference, collected_at=collected, eligible_revenue_php=body.eligible_revenue_php if deal else 0,
        amount_php=amount, evidence=body.evidence, status="submitted", due_at=collected + timedelta(days=terms["payment_days"]),
        created_at=now, events=[{"action": "submitted", "actor": user.id, "at": now.isoformat(), "note": body.evidence}])
    db.add(row)
    notify(db, p.builder_id, f"Compensation claim submitted: PHP {amount}. Review its evidence.", f"/pairings/{p.id}/compensation")
    db.commit()
    return output(row)


@router.post("/claims/{identifier}/action")
def claim_action(identifier: str, body: Action, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(CompensationClaim, identifier)
    if not row:
        raise NotFound("Claim")
    p = party(db, user, row.pairing_id, True)
    db.refresh(row, with_for_update=True)
    builder, operator, admin = user.id == p.builder_id, user.id == p.counterpart_id, "admin" in user.roles
    if not body.note.strip():
        raise Validation("Record the evidence or payment reference for this action")
    transitions = {
        "confirm": (builder and row.status == "submitted", "confirmed"),
        "dispute": ((builder or operator) and row.status in ("submitted", "confirmed", "payment_reported"), "disputed"),
        "report_payment": (builder and row.status == "confirmed", "payment_reported"),
        "acknowledge_payment": (operator and row.status == "payment_reported", "paid"),
        "resolve_payable": (admin and row.status == "disputed", "confirmed"),
        "resolve_not_payable": (admin and row.status == "disputed", "not_payable"),
    }
    allowed, state = transitions.get(body.action, (False, ""))
    if not allowed:
        raise Validation("This action is not available to you in the claim's current state")
    row.status = state
    row.events = [*row.events, {"action": body.action, "actor": user.id, "at": now_utc().isoformat(), "note": body.note}]
    if state == "disputed":
        db.add(ReviewCase(id=new_id("case"), pairing_id=p.id, opened_by=user.id, message=f"Claim {row.id}: {body.note}", status="open", created_at=now_utc()))
    for uid in (p.builder_id, p.counterpart_id):
        notify(db, uid, f"Claim {row.reference}: {state.replace('_', ' ')}.", f"/pairings/{p.id}/compensation")
    db.commit()
    return output(row)


@router.post("/review-cases/{identifier}/resolve")
def resolve_case(identifier: str, body: Action, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if "admin" not in user.roles:
        raise Forbidden("Only administrators record review outcomes")
    row = db.get(ReviewCase, identifier)
    if not row:
        raise NotFound("Review case")
    db.refresh(row, with_for_update=True)
    from app.services.operations import resolve
    resolve(db, row, user, body.note)
    db.commit()
    return output(row)


class GrantIn(BaseModel):
    entity: str = Field(min_length=3, max_length=300)
    share_class: str = Field(min_length=2, max_length=120)
    grant_units: int = Field(gt=0, le=1000000000)
    capitalization_units: int = Field(gt=0, le=10000000000)
    vesting_start: datetime
    vesting_months: int = Field(default=48, ge=24, le=120)
    cliff_months: int = Field(default=12, ge=12, le=24)
    signed_document_url: str = Field(pattern=r"^https://[^\s]+$", max_length=2000)
    approval_reference: str = Field(min_length=20, max_length=3000)
    departure_terms: str = Field(min_length=30, max_length=5000)
    confirms_authority_and_review: bool

    @field_validator("vesting_start")
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError("Include a timezone")
        return value


@router.post("/pairings/{identifier}/grants", status_code=201)
def offer_grant(identifier: str, body: GrantIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = party(db, user, identifier, True)
    commercial.verified(user)
    now = now_utc()
    if user.id != p.builder_id or p.protocol != "operator_v1" or p.state != "active" or now >= commercial.effective_end(p) or now < p.started_at + timedelta(days=p.proving_run_days):
        raise Validation("A separate cofounder offer requires an active continued engagement after the trial")
    if not body.confirms_authority_and_review or body.cliff_months > body.vesting_months or body.vesting_start < p.started_at:
        raise Validation("Confirm authority, legal review, and a valid vesting schedule")
    v = db.get(Venture, p.venture_id)
    db.refresh(v, with_for_update=True)
    grants = list(db.scalars(select(EquityGrant).where(EquityGrant.venture_id == v.id, EquityGrant.status.in_(("offered", "accepted")))).all())
    for grant in grants:
        if grant.status == "offered" and now >= grant.created_at + timedelta(days=14):
            grant.status = "expired"
    grants = [g for g in grants if g.status != "expired"]
    if any(g.pairing_id == p.id for g in grants):
        raise Validation("This engagement already has an outstanding or accepted grant")
    for g in grants:
        if any(g.terms[key] != getattr(body, key) for key in ("entity", "share_class", "capitalization_units")):
            raise Validation("Existing grants use a different capitalization basis. Reconcile the legal capitalization before offering more units.")
    legacy = db.scalar(select(func.coalesce(func.sum(VestingEntry.tranche_pct), 0)).join(Pairing).where(Pairing.venture_id == v.id))
    total = sum(g.terms["grant_units"] for g in grants) + body.grant_units
    if Decimal(total) * 100 / body.capitalization_units + Decimal(str(legacy)) > 40:
        raise Validation("This grant exceeds the available 40% platform allocation, including reserved and historical awards")
    terms = body.model_dump(mode="json")
    terms["version"] = "cofounder_v1"
    terms["continuation"] = "Acceptance continues the engagement without the original fixed expiry. Original cash compensation continues until a new written agreement or departure. The attached signed instrument controls equity rights; the platform does not issue shares."
    terms["hash"] = hashlib_terms(terms)
    row = EquityGrant(id=new_id("grant"), pairing_id=p.id, venture_id=v.id, terms=terms, status="offered", created_at=now)
    db.add(row)
    notify(db, p.counterpart_id, "Review the separate documented cofounder grant. It is not accepted yet.", f"/pairings/{p.id}/compensation")
    db.commit()
    return output(row)


def hashlib_terms(terms):
    import hashlib, json
    return hashlib.sha256(json.dumps(terms, sort_keys=True).encode()).hexdigest()


@router.post("/grants/{identifier}/action")
def grant_action(identifier: str, body: Action, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(EquityGrant, identifier)
    if not row:
        raise NotFound("Grant")
    p = party(db, user, row.pairing_id, True)
    db.refresh(row, with_for_update=True)
    commercial.verified(user)
    if user.id != p.counterpart_id or row.status != "offered" or body.action not in ("accept", "decline"):
        raise Validation("Only the counterpart can respond to a pending cofounder grant")
    if body.action == "accept":
        if p.state != "active" or now_utc() >= row.created_at + timedelta(days=14) or now_utc() >= commercial.effective_end(p) or body.agreement_hash != row.terms["hash"]:
            raise Validation("Reload the active engagement and confirm the exact grant version")
        row.status, row.accepted_at = "accepted", now_utc()
        p.state = "cofounder"
    else:
        row.status = "declined"
    db.commit()
    return output(row)

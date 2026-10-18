"""Accepted commercial engagements. No sales report automatically grants equity."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.domain.contracts import CommercialTerms, OPERATOR_TEMPLATE, OPERATOR_VERSION
from app.models import User, Venture, Pairing, ReviewCase, Application, EquityGrant
from app.services.common import Validation, Forbidden, now_utc, new_id
from app.services.notifications import notify


def verified(user):
    if not user.email_verified_at:
        raise Validation("Verify your email in Account before making or accepting an offer")


def make_offer(db, venture, application, builder, counterpart, now):
    verified(builder)
    try:
        terms = CommercialTerms.model_validate(venture.commercial_terms).model_dump(mode="json")
    except ValueError:
        raise Validation("Complete the paid commercial terms before sending an offer") from None
    if any(m.tranche_pct for m in venture.milestones) or venture.equity_max_pct:
        raise Validation("Legacy equity listings need a new commercial offer; existing rights are preserved")
    schedule = [{c.name: getattr(m, c.name) for c in m.__table__.columns} for m in venture.milestones]
    for m in schedule:
        m.update(status="locked", opened_at=None, cleared_at=None, missed_at=None, cleared_by_ledger_entry_id=None)
    values = {
        "CONTRACTING_PARTY": terms["contracting_party"], "VENTURE_NAME": venture.name,
        "BUILDER_NAME": builder.name, "COUNTERPART_NAME": counterpart.name,
        "OPERATOR_SCOPE": "\n".join(venture.counterpart_would_own),
        "BUILDER_COMMITMENTS": "\n".join(venture.builder_has_done),
        "TRIAL_DAYS": str(terms["trial_days"]), "TERM_DAYS": str(terms["term_days"]),
        "MONTHLY_FEE_PHP": terms["monthly_fee_php"], "COMMISSION_RATE_PCT": terms["commission_rate_pct"],
        "ELIGIBLE_REVENUE": terms["eligible_revenue"], "ATTRIBUTION_RULE": terms["attribution"],
        "PAYMENT_DAYS": str(terms["payment_days"]), "TAIL_DAYS": str(terms["tail_days"]),
        "EXPENSE_POLICY": terms["expense_policy"], "DISPUTE_PROCESS": terms["dispute_process"],
    }
    agreement = {"template": OPERATOR_TEMPLATE, "values": values, "terms": terms,
        "metrics": venture.metrics, "schedule": schedule, "application_id": application.id,
        "builder_id": builder.id, "counterpart_id": counterpart.id, "offered_at": now.isoformat()}
    agreement["hash"] = hashlib.sha256(json.dumps(agreement, sort_keys=True).encode()).hexdigest()
    p = Pairing(id=new_id("pair"), venture_id=venture.id, builder_id=builder.id, counterpart_id=counterpart.id,
        application_id=application.id, protocol=OPERATOR_VERSION, state="offered", offered_at=now,
        started_at=now, proving_run_days=terms["trial_days"], proving_run_deliverables=venture.counterpart_would_own,
        agreement=agreement, milestone_snapshot=schedule)
    db.add(p)
    notify(db, counterpart.id, f"{venture.name}: review your paid engagement offer. Work has not started.", f"/pairings/{p.id}/agreement")
    return p


def effective_end(p):
    if p.protocol != OPERATOR_VERSION or not p.accepted_at:
        return p.ended_at
    if p.state == "cofounder" or p.end_reason and p.end_reason.startswith("Cofounder departure:"):
        return p.ended_at or datetime(9999, 1, 1, tzinfo=timezone.utc)
    days = p.agreement["terms"]["term_days"] if p.converted_at else p.proving_run_days
    deadline = p.started_at + timedelta(days=days)
    return min(deadline, p.ended_at) if p.ended_at else deadline


def expire(db, p, now=None):
    now = now or now_utc()
    if p.protocol == OPERATOR_VERSION and p.state == "offered" and now >= p.offered_at + timedelta(days=14):
        p.state, p.ended_at, p.end_reason = "declined", p.offered_at + timedelta(days=14), "Offer expired"
        reopen_application(db, p)
    for grant in db.scalars(select(EquityGrant).where(EquityGrant.pairing_id == p.id, EquityGrant.status == "offered")):
        if p.state not in ("active", "cofounder") or now >= grant.created_at + timedelta(days=14) or now >= effective_end(p):
            grant.status = "expired"
    if p.protocol == OPERATOR_VERSION and p.state in ("proving_run", "active", "cofounder") and now >= effective_end(p):
        p.state, p.ended_at, p.end_reason = "released", effective_end(p), "Agreed engagement period ended"
        for uid in (p.builder_id, p.counterpart_id):
            notify(db, uid, "The engagement term ended. Accrued compensation and the agreed pipeline tail remain payable.", f"/pairings/{p.id}/compensation")
        db.flush()


def reopen_application(db, p):
    application = db.get(Application, p.application_id) if p.application_id else None
    if application and application.status == "invited":
        application.status = "shortlisted"


def action(db, p, user, action, agreement_hash=""):
    if user.id not in (p.builder_id, p.counterpart_id):
        raise Forbidden("Only the parties can accept or decline an agreement")
    db.refresh(p, with_for_update=True)
    now = now_utc()
    expire(db, p, now)
    if p.protocol != OPERATOR_VERSION:
        raise Validation("This is a historical engagement. Review its recorded agreement separately.")
    if action in ("accept", "decline"):
        if user.id != p.counterpart_id or p.state != "offered":
            raise Validation("Only the invited counterpart can respond to a pending offer")
        if action == "accept":
            verified(user)
            if agreement_hash != p.agreement.get("hash"):
                raise Validation("The agreement version does not match. Reload the offer before accepting.")
            if now > p.offered_at + timedelta(days=14):
                raise Validation("This offer expired after 14 days. Request a new offer.")
            p.state, p.started_at, p.accepted_at = "proving_run", now, now
        else:
            p.state, p.ended_at, p.end_reason = "declined", now, "Offer declined"
            reopen_application(db, p)
    elif action == "request_continuation":
        if user.id != p.builder_id or p.state != "proving_run":
            raise Validation("The builder can propose continuation during an accepted trial")
        p.continuation_requested_at = now
    elif action == "continue":
        if user.id != p.counterpart_id or p.state != "proving_run" or not p.continuation_requested_at:
            raise Validation("Both parties must agree to continuation")
        p.state, p.converted_at = "active", now
    else:
        raise Validation("Unknown agreement action")
    for uid in (p.builder_id, p.counterpart_id):
        notify(db, uid, f"Engagement update: {action.replace('_', ' ')}. Review the recorded agreement.", f"/pairings/{p.id}/agreement")
    db.commit()
    return p

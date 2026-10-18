"""Venture service. The publish rule lives here: no reachable product URL
and no screenshot means draft, and drafts never appear on the Bench."""
import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, Milestone, Pairing, User, Venture
from app.services.common import Forbidden, NotFound, Validation, new_id, now_utc
from app.services.url_probe import probe_url

LIVE = ("offered", "proving_run", "active", "cofounder")


def has_live_pairing(db: Session, venture_id: str) -> bool:
    return db.scalar(select(Pairing.id).where(Pairing.venture_id == venture_id, Pairing.state.in_(LIVE)).limit(1)) is not None


def has_completed_pairing(db: Session, venture_id: str) -> bool:
    return db.scalar(select(Pairing.id).where(Pairing.venture_id == venture_id, Pairing.state == "completed").limit(1)) is not None


def is_on_bench(db: Session, v: Venture) -> bool:
    return v.status in ("published", "development") and not has_live_pairing(db, v.id)


def list_bench(db: Session, category: str | None = None, stage: str | None = None, equity_min: float | None = None, equity_max: float | None = None, hours_max: int | None = None) -> list[dict]:
    ventures = db.scalars(select(Venture).where(Venture.status.in_(["published", "development"])).order_by(Venture.created_at.desc())).all()
    out = []
    for v in ventures:
        if v.status == "development" and any(value is not None for value in (equity_min, equity_max, hours_max)):
            continue
        if has_live_pairing(db, v.id):
            continue
        if category and v.category != category:
            continue
        if stage and v.stage != stage:
            continue
        if equity_min is not None and v.equity_max_pct < equity_min:
            continue
        if equity_max is not None and v.equity_min_pct > equity_max:
            continue
        if hours_max is not None and v.hours_per_week > hours_max:
            continue
        count = len(db.scalars(select(Application.id).where(Application.venture_id == v.id)).all())
        out.append({"venture": v, "applicant_count": count, "total_on_offer_pct": round(sum(m.tranche_pct for m in v.milestones), 2)})
    return out


def get_by_slug(db: Session, slug: str) -> Venture:
    v = db.scalar(select(Venture).where(Venture.slug == slug))
    if v is None:
        raise NotFound("Venture not found")
    return v


def can_manage(user: User, v: Venture) -> bool:
    return "admin" in user.roles or v.builder_id == user.id


def assert_can_manage(user: User, v: Venture) -> None:
    if not can_manage(user, v):
        raise Forbidden("Only the builder or an admin can manage this venture")


def is_http_url(value: str) -> bool:
    return bool(re.match(r"^https?://[^\s/]+", value or ""))


def check_publishable(v: Venture) -> list[str]:
    problems = []
    if v.moderation_hold:
        problems.append("An administrator must restore this listing before it can be published")
    from app.domain.contracts import CommercialTerms
    try:
        CommercialTerms.model_validate(v.commercial_terms)
    except ValueError:
        problems.append("Complete the paid commercial agreement before publishing")
    if v.equity_max_pct or any(m.tranche_pct for m in v.milestones):
        problems.append("Create a commercial listing without automatic equity awards")
    if not is_http_url(v.product_url):
        problems.append("Product URL must be a valid http(s) URL")
    elif v.product_url_verified_at is None:
        problems.append("Product URL has not been verified as reachable")
    if not v.screenshots:
        problems.append("At least one screenshot is required")
    if not v.milestones:
        problems.append("At least one milestone is required")
    return problems


def publish(db: Session, user: User, venture_id: str, now: datetime | None = None) -> Venture:
    v = db.get(Venture, venture_id)
    if v is None:
        raise NotFound("Venture not found")
    assert_can_manage(user, v)
    reachable, detail = probe_url(v.product_url)
    v.product_url_verified_at = (now or now_utc()) if reachable else None
    problems = check_publishable(v)
    if problems:
        db.commit()
        raise Validation(". ".join(f"{p} ({detail})" if "reachable" in p else p for p in problems))
    v.status = "published"
    db.commit()
    return v


def unpublish(db: Session, user: User, venture_id: str) -> Venture:
    v = db.get(Venture, venture_id)
    if v is None:
        raise NotFound("Venture not found")
    assert_can_manage(user, v)
    v.status = "draft"
    db.commit()
    return v


def slugify(name: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))[:60] or "venture"


def create(db: Session, user: User, data: dict) -> Venture:
    from app.schemas import VentureIn
    from app.domain.contracts import OPERATOR_VERSION
    data = VentureIn.model_validate(data).model_dump(mode="json")
    if "builder" not in user.roles and "admin" not in user.roles:
        raise Forbidden("Only builders can create ventures")
    if data["equity_min_pct"] > data["equity_max_pct"]:
        raise Validation("Equity minimum cannot exceed the maximum")
    if data["equity_max_pct"] > 40:
        raise Validation("The platform cap is 40%")
    if not data["milestones"]:
        raise Validation("Add at least one milestone")
    base = slugify(data["name"])
    slug, n = base, 2
    while db.scalar(select(Venture.id).where(Venture.slug == slug)) is not None:
        slug = f"{base}-{n}"
        n += 1
    metrics: dict[str, dict] = {}
    for m in data["milestones"]:
        metrics.setdefault(m["metric_key"], {"key": m["metric_key"], "label": m["metric_label"], "unit": m["unit"], "aggregation": m["aggregation"]})
    v = Venture(
        id=new_id("ven"), slug=slug, name=data["name"].strip(), one_liner=data["one_liner"].strip(), description=data["description"].strip(),
        category=data["category"], stage=data["stage"], status="draft", builder_id=user.id, location=data.get("location"),
        product_url=data["product_url"].strip(), screenshots=data.get("screenshots", []), traction_summary=data.get("traction_summary", ""),
        logo_url=data.get("logo_url"),
        equity_min_pct=data["equity_min_pct"], equity_max_pct=data["equity_max_pct"], hours_per_week=data["hours_per_week"],
        builder_has_done=data.get("builder_has_done", []), counterpart_would_own=data.get("counterpart_would_own", []),
        metrics=list(metrics.values()), pricing=data.get("pricing", []), unit_economics=data.get("unit_economics", {}),
        profitability_target=data.get("profitability_target", {}), interns_welcome=data.get("interns_welcome", False),
        vesting_terms=data.get("vesting_terms", ""), created_at=now_utc(),
        commercial_terms=data["commercial_terms"], terms_template_id=OPERATOR_VERSION,
    )
    db.add(v)
    for i, m in enumerate(data["milestones"], start=1):
        db.add(Milestone(id=new_id("ms"), venture_id=v.id, sequence=i, title=m["title"].strip(), metric_key=m["metric_key"], target_value=m["target_value"], tranche_pct=m["tranche_pct"], window_days=m["window_days"], is_proving_run=(i == 1)))
    db.commit()
    db.refresh(v)
    return v

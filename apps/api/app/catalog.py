"""One-time, idempotent import of the six owner-requested development projects.

Explicit operator command, never a startup seed. Existing records are untouched.
"""
import argparse
from sqlalchemy import select
from app.db import SessionLocal
from app.models import User, Venture
from app.services.common import now_utc, new_id
from app.services.metadata import fetch_metadata

PROJECTS = [
    ("creatorz", "Creatorz", "https://creatorz.ph/"),
    ("hirefrom", "Hire From PH", "https://hirefrom.ph/"),
    ("jinnie", "Jinnie", "https://jinnie.ph/"),
    ("gimik", "Gimik", "https://gimik.app/"),
    ("phriend", "Phriend", "https://phriend.app/"),
    ("kyp", "KYP", "https://kyp.ph/"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner", required=True)
    args = parser.parse_args()
    with SessionLocal() as db:
        owner = db.scalar(select(User).where(User.email == args.owner))
        if not owner:
            raise SystemExit("Create the owner account first")
        for slug, name, url in PROJECTS:
            if db.scalar(select(Venture.id).where((Venture.slug == slug) | (Venture.product_url == url))):
                print(slug, "already exists; preserved", flush=True)
                continue
            try:
                info = fetch_metadata(url)
            except Exception:
                info = {}
            description = info.get("description") or f"{name} is in development. More details will be added as the project takes shape."
            db.add(Venture(id=new_id("ven"), slug=slug, name=name, one_liner=description[:137] + ("…" if len(description) > 137 else ""),
                description=description, category="other", stage="development", status="development", builder_id=owner.id,
                product_url=url, screenshots=[info["image"]] if info.get("image") else [], logo_url=info.get("logo"),
                traction_summary="", equity_min_pct=0, equity_max_pct=0, hours_per_week=0,
                builder_has_done=[], counterpart_would_own=[], metrics=[], pricing=[], unit_economics={}, profitability_target={},
                interns_welcome=False, vesting_terms="", created_at=now_utc()))
            db.commit()
            print(slug, "added in development", {"image": bool(info.get("image")), "logo": bool(info.get("logo"))}, flush=True)


if __name__ == "__main__":
    main()

"""Create inspectable examples of all five states, only in the local database."""
from datetime import timedelta
from sqlalchemy import select
from sqlalchemy.engine import make_url
from app.config import settings
from app.db import SessionLocal
from app.models import User, Venture, Pairing, VestingEntry
from app.services import ventures, applications, ledger, pairings
from app.services.common import now_utc
from app.domain.ledger import week_start_of

url = make_url(settings.database_url)
assert settings.app_env == "local" and url.host in ("db", "localhost", "127.0.0.1") and url.database == "counterpart"
with SessionLocal() as db:
    builder = db.scalar(select(User).where(User.email == "builder@counterpart.test"))
    partner = db.scalar(select(User).where(User.email == "counterpart@counterpart.test"))
    assert builder and partner
    for state in ["proving_run", "active", "completed", "released", "lapsed"]:
        name = "Local lifecycle " + state
        if db.scalar(select(Venture.id).where(Venture.name == name)):
            continue
        now = now_utc()
        v = ventures.create(db, builder, {"name": name, "one_liner": "Local lifecycle testing only; not a real equity offer.",
            "description": "An inspectable local test of the Counterpart lifecycle. This project is never added to production.",
            "category": "saas", "stage": "live", "product_url": "https://example.com", "screenshots": ["https://counterpart.ph/logo.svg"],
            "equity_min_pct": 8, "equity_max_pct": 12, "hours_per_week": 20, "traction_summary": "Local test only",
            "unit_economics": {"unit_label": "customer", "revenue_per_unit_php_monthly": 100, "variable_cost_per_unit_php_monthly": 10, "note": "Test"},
            "profitability_target": {"monthly_contribution_php": 1000, "within_days": 90, "excludes": []},
            "milestones": [{"title": "First customers", "metric_key": "customers", "metric_label": "Customers", "unit": "count", "aggregation": "latest", "target_value": 3, "tranche_pct": 2, "window_days": 45},
                {"title": "First revenue", "metric_key": "revenue_php", "metric_label": "Revenue", "unit": "php", "aggregation": "sum", "target_value": 25000, "tranche_pct": 3, "window_days": 90}]})
        ventures.publish(db, builder, v.id)
        data = {"evidence": "Local scenario: experience and results entered for end-to-end testing. " * 4,
            "proof_links": ["https://example.com"], "numbers_moved": [{"metric": "Test", "before": "0", "after": "3", "timeframe": "1 week"}],
            "hours_per_week": 20, "compensation": "equity_only", "track": "counterpart", "requested_equity_pct": 10,
            "template_id": "growth", "commitments": [], "acknowledges_resource_clause": False, "why_this_venture": "Local lifecycle test."}
        application = applications.submit(db, partner, v, data, now)
        applications.review(db, builder, application.id, "shortlist", now)
        applications.review(db, builder, application.id, "invite", now)
        pairing = db.scalar(select(Pairing).where(Pairing.venture_id == v.id))
        if state in ("active", "released", "completed"):
            ledger.log_week(db, partner, pairing, week_start_of(now), {"customers": 3, "revenue_php": 0}, "First milestone", [], now)
            assert pairing.state == "active"
        if state == "completed":
            ledger.log_week(db, partner, pairing, week_start_of(now), {"customers": 3, "revenue_php": 25000}, "All milestones", [], now)
        if state == "released":
            vested_before = sum(x.tranche_pct for x in db.scalars(select(VestingEntry).where(VestingEntry.pairing_id == pairing.id)))
            pairings.end(db, builder, pairing, "Local release test", now)
            assert sum(x.tranche_pct for x in db.scalars(select(VestingEntry).where(VestingEntry.pairing_id == pairing.id))) == vested_before
        if state == "lapsed":
            pairings.sync(db, pairing, now + timedelta(days=46))
        assert pairing.state == state, (state, pairing.state)
        print("PASS", state, pairing.id, flush=True)

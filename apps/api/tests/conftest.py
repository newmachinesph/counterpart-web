import os
from datetime import date, datetime, timedelta, timezone

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.domain.ledger import Entry, Metric
from app.domain.milestones import MilestoneState
from app.main import app
from app.models import AuthSession, LedgerEntry, Milestone, Pairing, User, Venture
from app.accounts import token_hash
from app.config import settings


@pytest.fixture(autouse=True)
def isolate_external_services(monkeypatch):
    for key in ("redis_url", "upstash_redis_rest_url", "upstash_redis_rest_token", "ably_api_key", "didit_api_key", "didit_webhook_secret"):
        monkeypatch.setattr(settings, key, "")

# ---------------------------------------------------------------- domain fixtures

METRICS = [
    Metric("merchants_live", "Merchants live", "count", "latest"),
    Metric("revenue_php", "Revenue", "php", "sum"),
    Metric("paying_users", "Paying users", "count", "latest"),
]

START = datetime(2026, 6, 1, tzinfo=timezone.utc)


def entry(week: str, merchants: int, revenue: float, paying: int, entry_id: str | None = None) -> Entry:
    d = date.fromisoformat(week)
    at = datetime(d.year, d.month, d.day, 9, tzinfo=timezone.utc)
    return Entry(id=entry_id or f"le_{week}", week_starting=d, values={"merchants_live": merchants, "revenue_php": revenue, "paying_users": paying}, updated_at=at)


def kyp_milestones() -> list[MilestoneState]:
    return [
        MilestoneState("ms_a", 1, "Proving run: first merchants", "merchants_live", 3, 2, 45, True),
        MilestoneState("ms_b", 2, "First revenue", "revenue_php", 25000, 2, 90, False),
        MilestoneState("ms_c", 3, "Ten merchants live", "merchants_live", 10, 3, 120, False),
        MilestoneState("ms_d", 4, "Hundred paying users", "paying_users", 100, 5, 180, False),
    ]


@pytest.fixture
def metrics():
    return METRICS


# ---------------------------------------------------------------- database

MAIN_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://counterpart:counterpart@db:5432/counterpart")
TEST_DB = "counterpart_test"
TEST_URL = MAIN_URL.rsplit("/", 1)[0] + "/" + TEST_DB


def _ensure_test_database() -> None:
    from sqlalchemy.engine import make_url
    parsed = make_url(MAIN_URL)
    if parsed.host not in ("localhost", "127.0.0.1", "db") or parsed.username != "counterpart":
        raise RuntimeError("Tests only run against the isolated local Counterpart database")
    dsn = MAIN_URL.replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(dsn, autocommit=True) as conn:
        found = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)).fetchone()
        if not found:
            conn.execute(f'CREATE DATABASE "{TEST_DB}"')


@pytest.fixture(scope="session")
def engine():
    _ensure_test_database()
    eng = create_engine(TEST_URL, pool_pre_ping=True)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    """A clean database for every test."""
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db, monkeypatch):
    # API domain scenarios use the fixture clock, not the machine's current week.
    from app.services import applications, ledger, notifications, openings, pairings, ventures, commercial, common
    from app.routers import commercial as commercial_router
    for module in (applications, ledger, notifications, openings, pairings, ventures, commercial, commercial_router, common):
        monkeypatch.setattr(module, "now_utc", lambda: NOW)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def as_(user_id: str) -> dict[str, str]:
    """Bearer sessions exist only in the isolated test database."""
    return {"Authorization": f"Bearer test-session-{user_id}"}


# ---------------------------------------------------------------- factories

NOW = datetime(2026, 9, 9, 10, tzinfo=timezone.utc)
THIS_MONDAY = date(2026, 9, 7)
LAST_MONDAY = date(2026, 8, 31)
NEXT_MONDAY = date(2026, 9, 14)

VENTURE_METRICS = [
    {"key": "merchants_live", "label": "Merchants live", "unit": "count", "aggregation": "latest"},
    {"key": "revenue_php", "label": "Revenue", "unit": "php", "aggregation": "sum"},
]

MILESTONE_SPECS = [
    ("Proving run: first merchants", "merchants_live", 3, 0, 45),
    ("First revenue", "revenue_php", 25000, 0, 90),
]

COMMERCIAL_TERMS = dict(trial_days=45, term_days=180, monthly_fee_php="15000.00", commission_rate_pct="10.00",
    eligible_revenue="Collected subscription receipts excluding taxes, refunds and chargebacks.",
    attribution="Register sourced deals before collection with evidence of introduction.",
    payment_days=15, tail_days=90, expense_policy="Written approval and receipts are required.",
    contracting_party="Test Venture Corporation", dispute_process="Discuss documented evidence within 15 days, then use the agreed lawful forum.")


def make_user(db, user_id: str, roles: list[str], name: str | None = None) -> User:
    u = User(id=user_id, name=name or user_id.replace("usr_", "").title(), email=f"{user_id}@example.ph", roles=roles, headline="", location="Quezon City", email_verified_at=NOW)
    db.add(u)
    db.commit()
    db.add(AuthSession(token_hash=token_hash(f"test-session-{user_id}"), user_id=u.id, expires_at=datetime.now(timezone.utc) + timedelta(days=1)))
    db.commit()
    return u


def make_venture(db, venture_id: str = "ven_test", builder_id: str = "usr_builder", *, status: str = "published", interns_welcome: bool = False, equity: tuple[float, float] = (0, 0), milestones: list | None = None, **over) -> Venture:
    fields = dict(
        id=venture_id, slug=venture_id.replace("ven_", ""), name="Test Venture", commercial_terms=dict(COMMERCIAL_TERMS),
        one_liner="A one line description of the thing.",
        description="A description longer than fifty characters, comfortably.",
        category="saas", stage="live", status=status, builder_id=builder_id, location="Quezon City",
        product_url="https://example.com", product_url_verified_at=NOW, screenshots=["/screenshots/resibo.svg"],
        traction_summary="10 customers", equity_min_pct=equity[0], equity_max_pct=equity[1], hours_per_week=20,
        builder_has_done=["Shipped it"], counterpart_would_own=["Sales"], metrics=VENTURE_METRICS,
        pricing=[{"name": "Core", "price_php_monthly": 499, "includes": "Everything"}],
        unit_economics={"unit_label": "merchant", "revenue_per_unit_php_monthly": 620, "variable_cost_per_unit_php_monthly": 62, "note": ""},
        profitability_target={"monthly_contribution_php": 30000, "within_days": 270, "excludes": ["Hosting"]},
        interns_welcome=interns_welcome, vesting_terms="Per tranche.", created_at=NOW - timedelta(days=90),
    )
    fields.update(over)
    v = Venture(**fields)
    db.add(v)
    for i, (title, key, target, tranche, window) in enumerate(milestones or MILESTONE_SPECS, start=1):
        db.add(Milestone(id=f"ms_{venture_id[4:]}_{i}", venture_id=v.id, sequence=i, title=title, metric_key=key, target_value=target, tranche_pct=tranche, window_days=window, is_proving_run=(i == 1)))
    db.commit()
    db.refresh(v)
    return v

def make_pairing(db, pairing_id: str = "pair_test", venture_id: str = "ven_test", builder_id: str = "usr_builder", counterpart_id: str = "usr_cp", *, state: str = "proving_run", started_at: datetime | None = None) -> Pairing:
    p = Pairing(id=pairing_id, venture_id=venture_id, builder_id=builder_id, counterpart_id=counterpart_id, state=state, started_at=started_at or (NOW - timedelta(days=14)), proving_run_days=45, proving_run_deliverables=["Sign three merchants"])
    db.add(p)
    db.commit()
    return p


def make_entry(db, pairing_id: str, week: date, values: dict, note: str = "") -> LedgerEntry:
    at = datetime(week.year, week.month, week.day, 10, tzinfo=timezone.utc)
    e = LedgerEntry(id=f"le_{pairing_id}_{week.isoformat()}", pairing_id=pairing_id, week_starting=week, values=values, note=note, evidence_links=[], submitted_at=at, updated_at=at)
    db.add(e)
    db.commit()
    return e


APPLICATION = {
    "evidence": "x" * 210,
    "proof_links": ["https://example.com/proof"],
    "numbers_moved": [{"metric": "Accounts", "before": "0", "after": "85", "timeframe": "24 months"}],
    "hours_per_week": 20,
    "compensation": "cash",
    "track": "counterpart",
    "requested_equity_pct": 0,
    "template_id": "operator_v1",
    "commitments": ["My own transport"],
    "acknowledges_resource_clause": False,
    "why_this_venture": "Because I already know these customers well.",
}


@pytest.fixture
def world(db):
    """A builder, a counterpart, an investor, an admin, a venture, and a pairing."""
    make_user(db, "usr_builder", ["builder"], "Marco Alviar")
    make_user(db, "usr_cp", ["counterpart"], "Maria Santos")
    make_user(db, "usr_cp2", ["counterpart"], "Jose Reyes")
    make_user(db, "usr_kaye", ["investor"], "Kaye Buenaventura")
    make_user(db, "usr_admin", ["admin"], "Counterpart admin")
    make_user(db, "usr_other", ["builder"], "Someone Else")
    v = make_venture(db)
    return {"venture": v}

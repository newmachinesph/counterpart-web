"""The Bench, venture detail, and the publish rule over HTTP."""
import pytest

from app.services import ventures as svc
from tests.conftest import COMMERCIAL_TERMS, NOW, as_, make_pairing, make_user, make_venture


def test_health_needs_nothing(client):
    assert client.get("/health").json() == {"ok": True}


def test_me_requires_a_known_session(client, world):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers=as_("usr_ghost")).status_code == 401
    body = client.get("/me", headers=as_("usr_cp")).json()
    assert body["name"] == "Maria Santos" and body["roles"] == ["counterpart"]


def test_bench_lists_published_ventures_without_a_live_pairing(client, db, world):
    make_venture(db, "ven_draft", status="draft", slug="draft-one")
    make_venture(db, "ven_taken", slug="taken")
    make_pairing(db, "pair_taken", venture_id="ven_taken", state="active")
    slugs = [c["venture"]["slug"] for c in client.get("/bench").json()]
    assert "test" in slugs
    assert "draft-one" not in slugs
    assert "taken" not in slugs


def test_bench_returns_a_venture_after_its_pairing_ends(client, db, world):
    make_venture(db, "ven_free", slug="free")
    make_pairing(db, "pair_free", venture_id="ven_free", state="released")
    assert "free" in [c["venture"]["slug"] for c in client.get("/bench").json()]


def test_bench_filters(client, db, world):
    make_venture(db, "ven_cheap", slug="cheap", equity=(4, 6), category="fintech", hours_per_week=5)
    assert [c["venture"]["slug"] for c in client.get("/bench?category=fintech").json()] == ["cheap"]
    assert [c["venture"]["slug"] for c in client.get("/bench?hours_max=10").json()] == ["cheap"]
    assert client.get("/bench?equity_min=10").json() == []
    assert client.get("/bench?category=loyalty").json() == []


def test_bench_card_carries_counts_and_equity(client, world):
    card = client.get("/bench").json()[0]
    assert card["applicant_count"] == 0
    assert card["total_on_offer_pct"] == 0
    assert card["venture"]["profitability_target"]["monthly_contribution_php"] == 30000
    assert card["venture"]["unit_economics"]["revenue_per_unit_php_monthly"] == 620
    assert len(card["venture"]["milestones"]) == 2


def test_venture_detail_hides_drafts(client, db, world):
    make_venture(db, "ven_hidden", status="draft", slug="hidden")
    assert client.get("/ventures/test").json()["name"] == "Test Venture"
    assert client.get("/ventures/hidden").status_code == 404
    assert client.get("/ventures/nothing-here").status_code == 404


def test_only_builders_create_ventures(client, world):
    body = {
        "name": "New Thing", "one_liner": "It does a thing for people.",
        "description": "A description that is comfortably longer than fifty characters for validation.",
        "category": "saas", "stage": "live", "product_url": "https://example.com",
        "commercial_terms": COMMERCIAL_TERMS, "equity_min_pct": 0, "equity_max_pct": 0, "hours_per_week": 20,
        "milestones": [{"title": "Proving run", "metric_key": "customers", "metric_label": "Customers", "unit": "count", "aggregation": "latest", "target_value": 3, "tranche_pct": 0, "window_days": 45}],
    }
    assert client.post("/ventures", json=body, headers=as_("usr_cp")).status_code == 403
    created = client.post("/ventures", json=body, headers=as_("usr_builder"))
    assert created.status_code == 201
    assert created.json()["status"] == "draft"
    assert created.json()["slug"] == "new-thing"


def test_creating_a_venture_refuses_a_range_above_the_cap(client, world):
    body = {
        "name": "Greedy", "one_liner": "It asks for far too much equity.",
        "description": "A description that is comfortably longer than fifty characters for validation.",
        "category": "saas", "stage": "live", "product_url": "https://example.com",
        "equity_min_pct": 10, "equity_max_pct": 60, "hours_per_week": 20,
        "milestones": [{"title": "Proving run", "metric_key": "customers", "metric_label": "Customers", "unit": "count", "aggregation": "latest", "target_value": 3, "tranche_pct": 0, "window_days": 45}],
    }
    r = client.post("/ventures", json=body, headers=as_("usr_builder"))
    assert r.status_code == 422


@pytest.fixture
def draft(db, world):
    return make_venture(db, "ven_new", status="draft", slug="new", product_url="", screenshots=[])


def test_publish_refuses_a_venture_with_no_working_product(client, db, draft, monkeypatch):
    monkeypatch.setattr(svc, "probe_url", lambda url: (False, "No response"))
    r = client.post("/ventures/ven_new/publish", headers=as_("usr_builder"))
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert "Product URL" in detail and "screenshot" in detail
    assert db.get(type(draft), "ven_new").status == "draft"


def test_publish_refuses_when_the_url_does_not_answer(client, db, draft, monkeypatch):
    draft.product_url, draft.screenshots = "https://nope.invalid", ["/s.svg"]
    db.commit()
    monkeypatch.setattr(svc, "probe_url", lambda url: (False, "No response: ConnectError"))
    r = client.post("/ventures/ven_new/publish", headers=as_("usr_builder"))
    assert r.status_code == 400 and "reachable" in r.json()["detail"]
    assert db.get(type(draft), "ven_new").product_url_verified_at is None


def test_publish_and_unpublish_when_the_url_answers(client, db, draft, monkeypatch):
    draft.product_url, draft.screenshots = "https://example.com", ["/s.svg"]
    db.commit()
    monkeypatch.setattr(svc, "probe_url", lambda url: (True, "Responded with HTTP 200"))
    published = client.post("/ventures/ven_new/publish", headers=as_("usr_builder")).json()
    assert published["status"] == "published" and published["product_url_verified_at"] is not None
    assert "new" in [c["venture"]["slug"] for c in client.get("/bench").json()]
    assert client.post("/ventures/ven_new/unpublish", headers=as_("usr_builder")).json()["status"] == "draft"
    assert "new" not in [c["venture"]["slug"] for c in client.get("/bench").json()]


def test_only_the_builder_or_an_admin_may_publish(client, draft, monkeypatch):
    monkeypatch.setattr(svc, "probe_url", lambda url: (True, "ok"))
    assert client.post("/ventures/ven_new/publish", headers=as_("usr_cp")).status_code == 403
    assert client.post("/ventures/ven_new/publish", headers=as_("usr_other")).status_code == 403
    assert client.post("/ventures/ven_missing/publish", headers=as_("usr_builder")).status_code == 404


def test_equity_templates_are_public_and_capped(client):
    body = client.get("/equity/templates").json()
    assert body["cap_pct"] == 40 and body["resource_clause_pct"] == 25
    assert [t["id"] for t in body["templates"]] == ["intern", "closer", "growth", "operator"]
    assert max(t["equity_max_pct"] for t in body["templates"]) == 40
    assert "own resources" in body["resource_clause"]
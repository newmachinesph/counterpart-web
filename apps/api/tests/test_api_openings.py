"""The job board: who may post, the funding rule, and applying."""
import pytest

from tests.conftest import THIS_MONDAY, as_, make_entry, make_pairing, make_user, make_venture

ROLE = {
    "compensation_details": "Test Venture Corporation employs this role for 20 hours weekly, paying monthly by bank transfer with statutory benefits and approved expense reimbursement.",
    "venture_id": "ven_test", "title": "Field sales representative", "team": "Field sales",
    "type": "part_time", "arrangement": "onsite", "location": "Quezon City",
    "summary": "Walk the route and sign up merchants around Maginhawa.",
    "responsibilities": ["Visit 20 shops a week"], "looking_for": ["You have sold door to door"],
    "salary_min_php_monthly": 4000, "salary_max_php_monthly": 6000, "equity_pct": None,
    "funded_by": "ledger_revenue",
}

APPLICATION = {
    "evidence": "x" * 150, "proof_links": ["https://example.com/proof"],
    "available_from": "2026-10-05", "expected_salary_php_monthly": 8000,
    "why_this_role": "I know the route already.",
}


@pytest.fixture
def hiring(db, world):
    """An active pairing whose ledger recorded revenue this week."""
    make_pairing(db, state="active")
    make_entry(db, "pair_test", THIS_MONDAY, {"merchants_live": 4, "revenue_php": 9000})
    return world


def post(client, user_id, **over):
    return client.post("/jobs", json={**ROLE, **over}, headers=as_(user_id))


def test_the_board_is_public_and_starts_empty(client, world):
    assert client.get("/jobs").json() == []


def test_a_builder_posts_a_role_the_ledger_can_pay_for(client, hiring):
    r = post(client, "usr_builder")
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "open" and body["funded_by"] == "ledger_revenue"
    card = client.get("/jobs").json()[0]
    assert card["ledger_revenue_php"] == 9000
    assert card["venture"]["slug"] == "test"
    assert card["applicant_count"] == 0


def test_the_counterpart_holding_the_seat_may_also_post(client, hiring):
    assert post(client, "usr_cp").status_code == 201


def test_nobody_else_may_post_for_a_venture(client, hiring):
    assert post(client, "usr_cp2").status_code == 403
    assert post(client, "usr_other").status_code == 403


def test_a_role_cannot_promise_money_the_ledger_has_not_seen(client, hiring):
    r = post(client, "usr_builder", salary_max_php_monthly=40000)
    assert r.status_code == 400 and "9,000 a month" in r.json()["detail"]


def test_a_venture_with_no_ledger_revenue_must_fund_the_role_another_way(client, db, world):
    make_venture(db, "ven_dry", slug="dry")
    r = post(client, "usr_builder", venture_id="ven_dry")
    assert r.status_code == 400 and "no revenue yet" in r.json()["detail"]
    ok = post(client, "usr_builder", venture_id="ven_dry", funded_by="outside_funding", salary_max_php_monthly=30000)
    assert ok.status_code == 201


def test_pay_and_no_pay_funding_cannot_be_mixed(client, hiring):
    for source in ("commission_only", "equity_only"):
        assert post(client, "usr_builder", funded_by=source).status_code == 422
    assert post(client, "usr_builder", salary_min_php_monthly=None, salary_max_php_monthly=None).status_code == 422


def test_employee_equity_stays_below_a_counterpart_seat(client, hiring):
    assert post(client, "usr_builder", equity_pct=2).status_code == 422
    assert post(client, "usr_builder", equity_pct=9, title="Another").status_code == 422


def test_only_admins_post_counterpart_roles(client, world):
    role = {**ROLE, "venture_id": None, "funded_by": "outside_funding", "salary_min_php_monthly": 70000, "salary_max_php_monthly": 110000}
    assert client.post("/jobs", json=role, headers=as_("usr_builder")).status_code == 403
    r = client.post("/jobs", json=role, headers=as_("usr_admin"))
    assert r.status_code == 201 and r.json()["venture_id"] is None
    assert client.get("/jobs").json()[0]["venture"] is None


def test_a_counterpart_role_cannot_claim_a_venture_ledger(client, world):
    role = {**ROLE, "venture_id": None}
    r = client.post("/jobs", json=role, headers=as_("usr_admin"))
    assert r.status_code == 400 and "not paid from a venture ledger" in r.json()["detail"]


def test_a_draft_venture_cannot_hire(client, db, world):
    make_venture(db, "ven_hidden", slug="hidden", status="draft")
    r = post(client, "usr_builder", venture_id="ven_hidden", funded_by="outside_funding")
    assert r.status_code == 400 and "Publish the venture" in r.json()["detail"]


def test_the_board_filters_and_hides_closed_roles(client, hiring):
    opening_id = post(client, "usr_builder").json()["id"]
    assert len(client.get("/jobs?type=part_time").json()) == 1
    assert client.get("/jobs?type=full_time").json() == []
    assert client.get("/jobs?arrangement=remote").json() == []
    assert client.get("/jobs?counterpart_only=true").json() == []
    closed = client.post(f"/jobs/{opening_id}/status", json={"status": "closed"}, headers=as_("usr_builder"))
    assert closed.json()["status"] == "closed"
    assert client.get("/jobs").json() == []


def test_anyone_signed_in_may_apply_once(client, hiring):
    opening_id = post(client, "usr_builder").json()["id"]
    assert client.post(f"/jobs/{opening_id}/applications", json=APPLICATION).status_code == 401
    r = client.post(f"/jobs/{opening_id}/applications", json=APPLICATION, headers=as_("usr_cp2"))
    assert r.status_code == 201 and r.json()["status"] == "submitted"
    assert client.post(f"/jobs/{opening_id}/applications", json=APPLICATION, headers=as_("usr_cp2")).status_code == 400
    assert client.get("/jobs").json()[0]["applicant_count"] == 1


def test_whoever_posted_it_cannot_apply_to_it(client, hiring):
    opening_id = post(client, "usr_builder").json()["id"]
    r = client.post(f"/jobs/{opening_id}/applications", json=APPLICATION, headers=as_("usr_builder"))
    assert r.status_code == 400 and "You posted this role" in r.json()["detail"]


def test_a_closed_role_takes_no_applications(client, hiring):
    opening_id = post(client, "usr_builder").json()["id"]
    client.post(f"/jobs/{opening_id}/status", json={"status": "closed"}, headers=as_("usr_builder"))
    r = client.post(f"/jobs/{opening_id}/applications", json=APPLICATION, headers=as_("usr_cp2"))
    assert r.status_code == 400 and "no longer open" in r.json()["detail"]


def test_an_application_still_needs_evidence_and_proof(client, hiring):
    opening_id = post(client, "usr_builder").json()["id"]
    short = client.post(f"/jobs/{opening_id}/applications", json={**APPLICATION, "evidence": "short"}, headers=as_("usr_cp2"))
    assert short.status_code == 400 and "at least 120" in short.json()["detail"]
    bare = client.post(f"/jobs/{opening_id}/applications", json={**APPLICATION, "proof_links": []}, headers=as_("usr_cp2"))
    assert bare.status_code == 400


def test_the_queue_belongs_to_whoever_manages_the_role(client, hiring):
    opening_id = post(client, "usr_builder").json()["id"]
    client.post(f"/jobs/{opening_id}/applications", json=APPLICATION, headers=as_("usr_cp2"))
    assert client.get(f"/jobs/{opening_id}/applications", headers=as_("usr_cp2")).status_code == 403
    queue = client.get(f"/jobs/{opening_id}/applications", headers=as_("usr_builder")).json()
    assert len(queue) == 1 and queue[0]["applicant_id"] == "usr_cp2"
    assert len(client.get("/my/job-applications", headers=as_("usr_cp2")).json()) == 1


def test_shortlist_decline_and_hire(client, hiring):
    opening_id = post(client, "usr_builder").json()["id"]
    app_id = client.post(f"/jobs/{opening_id}/applications", json=APPLICATION, headers=as_("usr_cp2")).json()["id"]
    assert client.post(f"/job-applications/{app_id}/review", json={"action": "shortlist"}, headers=as_("usr_builder")).json()["status"] == "shortlisted"
    hired = client.post(f"/job-applications/{app_id}/review", json={"action": "hire"}, headers=as_("usr_builder"))
    assert hired.json()["status"] == "offered"
    assert hired.json()["offer_snapshot"]["salary_php_monthly"] == 4000
    assert client.get(f"/jobs/{opening_id}").json()["opening"]["status"] == "open"
    assert client.post(f"/job-applications/{app_id}/respond", json={"action":"hire"}, headers=as_("usr_cp2")).status_code == 400
    assert client.post(f"/job-applications/{app_id}/respond", json={"action":"hire", "agreement_hash": hired.json()["offer_snapshot"]["hash"]}, headers=as_("usr_cp2")).json()["status"] == "hired"
    assert client.get(f"/jobs/{opening_id}").json()["opening"]["status"] == "filled"
    assert any("Review the offer" in n["body"] for n in client.get("/notifications", headers=as_("usr_cp2")).json())
    again = client.post(f"/job-applications/{app_id}/review", json={"action": "decline"}, headers=as_("usr_builder"))
    assert again.status_code == 400


def test_posting_notifies_whoever_owns_the_role(client, hiring):
    opening_id = post(client, "usr_cp").json()["id"]
    client.post(f"/jobs/{opening_id}/applications", json=APPLICATION, headers=as_("usr_cp2"))
    assert any("applied for" in n["body"] for n in client.get("/notifications", headers=as_("usr_cp")).json())

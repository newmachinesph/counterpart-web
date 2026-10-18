"""Applying, the equity rules, and the builder's review queue over HTTP."""
import pytest

from tests.conftest import APPLICATION, COMMERCIAL_TERMS, as_, make_pairing, make_venture


def apply_as(client, user_id: str, slug: str = "test", **over):
    return client.post(f"/ventures/{slug}/applications", json={**APPLICATION, **over}, headers=as_(user_id))


def test_a_counterpart_can_apply_once(client, world):
    r = apply_as(client, "usr_cp")
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "submitted" and body["requested_equity_pct"] == 0 and body["template_id"] == "operator_v1"
    assert apply_as(client, "usr_cp").status_code == 400


def test_development_applications_can_be_reviewed_before_terms_are_ready(client, db, world):
    venture = world["venture"]
    venture.status, venture.stage, venture.commercial_terms = "development", "development", {}
    db.commit()
    response = apply_as(client, "usr_cp")
    assert response.status_code == 201
    app_id = response.json()["id"]
    assert apply_as(client, "usr_cp").status_code == 400
    queue = client.get("/ventures/test/applications", headers=as_("usr_builder")).json()
    assert [a["id"] for a in queue] == [app_id]
    route = f"/applications/{app_id}/review"
    assert client.post(route, json={"action": "shortlist"}, headers=as_("usr_builder")).json()["status"] == "shortlisted"
    blocked = client.post(route, json={"action": "invite"}, headers=as_("usr_builder"))
    assert blocked.status_code == 400 and "paid commercial terms" in blocked.json()["detail"]
    assert client.get("/pairings", headers=as_("usr_cp")).json() == []
    venture.commercial_terms = dict(COMMERCIAL_TERMS)
    db.commit()
    invited = client.post(route, json={"action": "invite"}, headers=as_("usr_builder"))
    assert invited.status_code == 200 and invited.json()["status"] == "invited"
    pairing = client.get("/pairings", headers=as_("usr_cp")).json()[0]
    assert pairing["state"] == "offered" and pairing["accepted_at"] is None


@pytest.mark.parametrize("status", ["draft", "published"])
def test_unpublished_or_unpriced_live_listings_still_reject_applications(client, db, world, status):
    venture = world["venture"]
    venture.status, venture.commercial_terms = status, {}
    db.commit()
    assert apply_as(client, "usr_cp").status_code == 400


@pytest.mark.parametrize("state", ["offered", "proving_run", "active", "cofounder"])
def test_development_ventures_with_a_live_pairing_reject_applications(client, db, world, state):
    world["venture"].status = "development"
    db.commit()
    make_pairing(db, "pair_live", venture_id="ven_test", state=state)
    assert apply_as(client, "usr_cp2").status_code == 400
    assert not any(card["venture"]["id"] == "ven_test" for card in client.get("/bench").json())


def test_builders_and_owners_cannot_apply(client, world):
    assert apply_as(client, "usr_other").status_code == 403  # no counterpart role
    assert apply_as(client, "usr_builder").status_code == 403


def test_cannot_apply_to_a_venture_with_a_live_pairing(client, db, world):
    make_pairing(db, "pair_live", venture_id="ven_test", state="active")
    r = apply_as(client, "usr_cp")
    assert r.status_code == 400 and "not open" in r.json()["detail"]


def test_evidence_proof_and_numbers_are_required(client, world):
    assert apply_as(client, "usr_cp", evidence="too short").status_code == 400
    assert apply_as(client, "usr_cp", proof_links=[]).status_code == 400
    assert apply_as(client, "usr_cp", numbers_moved=[]).status_code == 400


def test_the_forty_percent_cap_is_refused_at_the_schema(client, world):
    r = apply_as(client, "usr_cp", requested_equity_pct=45, template_id="operator", acknowledges_resource_clause=True)
    assert r.status_code == 422


def test_the_request_must_sit_inside_the_venture_range(client, world):
    for equity in (0.5, 5, 20, 40):
        assert apply_as(client, "usr_cp", requested_equity_pct=equity).status_code == 422


def test_the_resource_clause_gates_the_operating_seat(client, world):
    # Self-funding does not create an entitlement to ownership.
    assert apply_as(client, "usr_cp", template_id="operator", requested_equity_pct=30, acknowledges_resource_clause=True).status_code == 422


def test_interns_only_where_welcome_and_only_in_their_tranche(client, world):
    assert apply_as(client, "usr_cp", track="intern").status_code == 422


def test_a_structure_from_the_other_track_is_refused(client, world):
    r = apply_as(client, "usr_cp", track="intern", template_id="closer", requested_equity_pct=1)
    assert r.status_code == 422


def test_the_queue_belongs_to_the_builder(client, world):
    apply_as(client, "usr_cp")
    assert client.get("/ventures/test/applications", headers=as_("usr_cp")).status_code == 403
    queue = client.get("/ventures/test/applications", headers=as_("usr_builder")).json()
    assert len(queue) == 1 and queue[0]["applicant_id"] == "usr_cp"
    assert len(client.get("/ventures/test/applications", headers=as_("usr_admin")).json()) == 1


def test_shortlist_decline_and_invite(client, world):
    app_id = apply_as(client, "usr_cp").json()["id"]
    shortlisted = client.post(f"/applications/{app_id}/review", json={"action": "shortlist"}, headers=as_("usr_builder"))
    assert shortlisted.json()["status"] == "shortlisted"
    invited = client.post(f"/applications/{app_id}/review", json={"action": "invite"}, headers=as_("usr_builder"))
    assert invited.json()["status"] == "invited"
    pairings = client.get("/pairings", headers=as_("usr_cp")).json()
    assert len(pairings) == 1 and pairings[0]["state"] == "offered" and pairings[0]["counterpart_id"] == "usr_cp"


def test_a_decided_application_cannot_be_decided_again(client, world):
    app_id = apply_as(client, "usr_cp").json()["id"]
    client.post(f"/applications/{app_id}/review", json={"action": "decline"}, headers=as_("usr_builder"))
    again = client.post(f"/applications/{app_id}/review", json={"action": "shortlist"}, headers=as_("usr_builder"))
    assert again.status_code == 400 and "already been declined" in again.json()["detail"]


def test_cannot_invite_a_second_counterpart_while_one_is_live(client, world):
    first = apply_as(client, "usr_cp").json()["id"]
    second = apply_as(client, "usr_cp2").json()["id"]
    client.post(f"/applications/{first}/review", json={"action": "invite"}, headers=as_("usr_builder"))
    blocked = client.post(f"/applications/{second}/review", json={"action": "invite"}, headers=as_("usr_builder"))
    assert blocked.status_code == 400 and "already has a live pairing" in blocked.json()["detail"]


def test_review_refuses_strangers_and_unknown_applications(client, world):
    app_id = apply_as(client, "usr_cp").json()["id"]
    assert client.post(f"/applications/{app_id}/review", json={"action": "shortlist"}, headers=as_("usr_cp")).status_code == 403
    assert client.post("/applications/nope/review", json={"action": "shortlist"}, headers=as_("usr_builder")).status_code == 404
    assert client.post(f"/applications/{app_id}/review", json={"action": "fire"}, headers=as_("usr_builder")).status_code == 422

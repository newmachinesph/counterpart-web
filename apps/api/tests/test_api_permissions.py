"""Who may see and who may act, checked at the edge."""
import pytest

from tests.conftest import as_, make_pairing, make_venture


@pytest.fixture
def two_pairings(db, world):
    make_venture(db, "ven_second", builder_id="usr_other", slug="second")
    make_pairing(db, "pair_one", venture_id="ven_test", builder_id="usr_builder", counterpart_id="usr_cp")
    make_pairing(db, "pair_two", venture_id="ven_second", builder_id="usr_other", counterpart_id="usr_cp2")


def test_every_protected_route_refuses_an_anonymous_caller(client, db, world):
    make_pairing(db)
    anonymous = [
        client.get("/me"),
        client.get("/pairings"),
        client.get("/pairings/pair_test"),
        client.get("/notifications"),
        client.post("/pairings/pair_test/ledger", json={"week_starting": "2026-09-07", "values": {}}),
        client.post("/pairings/pair_test/end", json={"reason": ""}),
        client.post("/ventures", json={}),
    ]
    assert [r.status_code for r in anonymous] == [401] * len(anonymous)


def test_a_party_sees_only_their_own_pairings(client, two_pairings):
    assert [p["id"] for p in client.get("/pairings", headers=as_("usr_cp")).json()] == ["pair_one"]
    assert [p["id"] for p in client.get("/pairings", headers=as_("usr_cp2")).json()] == ["pair_two"]
    assert [p["id"] for p in client.get("/pairings", headers=as_("usr_builder")).json()] == ["pair_one"]


def test_investors_and_admins_read_every_pairing(client, two_pairings):
    for who in ("usr_admin",):
        ids = sorted(p["id"] for p in client.get("/pairings", headers=as_(who)).json())
        assert ids == ["pair_one", "pair_two"], who
        assert client.get("/pairings/pair_one", headers=as_(who)).status_code == 200


def test_a_stranger_cannot_open_someone_elses_pairing(client, two_pairings):
    assert client.get("/pairings/pair_two", headers=as_("usr_cp")).status_code == 403


def test_an_investor_reads_but_never_acts(client, two_pairings):
    assert client.get("/pairings/pair_one", headers=as_("usr_kaye")).status_code == 403
    ended = client.post("/pairings/pair_one/end", json={"reason": "Curious"}, headers=as_("usr_kaye"))
    assert ended.status_code == 403 and "builder or the Counterpart" in ended.json()["detail"]
    review = client.post("/pairings/pair_one/review-request", json={"message": "Question"}, headers=as_("usr_kaye"))
    assert review.status_code == 403


def test_both_parties_may_end_and_request_a_review(client, two_pairings):
    assert client.post("/pairings/pair_one/review-request", json={"message": "Numbers look off."}, headers=as_("usr_cp")).status_code == 204
    assert client.post("/pairings/pair_one/review-request", json={"message": ""}, headers=as_("usr_builder")).status_code == 400
    ended = client.post("/pairings/pair_one/end", json={"reason": "Moving on."}, headers=as_("usr_builder"))
    assert ended.status_code == 200 and ended.json()["state"] == "released"


def test_ending_an_ended_pairing_is_a_conflict(client, db, world):
    make_pairing(db, state="released")
    r = client.post("/pairings/pair_test/end", json={"reason": ""}, headers=as_("usr_cp"))
    assert r.status_code == 400


def test_notifications_are_per_user(client, two_pairings):
    client.post("/pairings/pair_one/review-request", json={"message": "Please look."}, headers=as_("usr_cp"))
    builder = client.get("/notifications", headers=as_("usr_builder")).json()
    admin = client.get("/notifications", headers=as_("usr_admin")).json()
    stranger = client.get("/notifications", headers=as_("usr_cp2")).json()
    assert any("requested a review" in n["body"] for n in builder)
    assert any("Review requested by" in n["body"] for n in admin)
    assert stranger == []
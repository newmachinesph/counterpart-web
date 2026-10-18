import pytest
from app.models import ReviewCase
from app.services.common import now_utc
from app.services.ventures import check_publishable
from tests.conftest import as_, make_pairing


def request(client, user="usr_cp", **changes):
    return client.post("/support/requests", headers=as_(user), json={
        "category": "support", "subject": "Help with my application",
        "message": "Please help me understand the status of my application.", **changes,
    })


def update(client, identifier, version, action, user="usr_admin", **changes):
    return client.post(f"/admin/cases/{identifier}", headers=as_(user), json={"version": version, "action": action, **changes})


@pytest.mark.parametrize("user", ["usr_builder", "usr_cp", "usr_kaye"])
def test_operations_are_admin_only(client, world, user):
    for route in ("/admin/overview", "/admin/cases", "/admin/cases/nope"):
        assert client.get(route, headers=as_(user)).status_code == 403
    assert update(client, "nope", 0, "start", user=user).status_code == 403
    assert client.get("/admin/overview").status_code == 401


def test_support_intake_is_private_and_does_not_leak_internal_notes(client, world):
    response = request(client, category="account", subject="Account closure request")
    assert response.status_code == 201
    identifier = response.json()["id"]
    assert "events" not in response.json()
    assert client.get("/support/requests", headers=as_("usr_cp2")).json()["items"] == []
    assert update(client, identifier, 0, "note", note="Internal investigation details").status_code == 200
    own = client.get("/support/requests", headers=as_("usr_cp")).json()["items"][0]
    assert "events" not in own and "reporter" not in own
    assert "Internal investigation" not in str(own)
    assert client.get("/me", headers=as_("usr_cp")).status_code == 200  # A request does not delete an account.


def test_ownership_resolution_reopening_and_stale_updates_preserve_history(client, db, world):
    identifier = request(client).json()["id"]
    assert update(client, identifier, 0, "assign", assigned_to="usr_cp").status_code == 400
    assert update(client, identifier, 0, "assign", assigned_to="usr_admin").status_code == 200
    assert update(client, identifier, 0, "start").status_code == 409
    assert update(client, identifier, 1, "start").status_code == 200
    assert update(client, identifier, 2, "resolve", note=" ").status_code == 400
    resolution = "We reviewed the application and explained the next steps."
    assert update(client, identifier, 2, "resolve", note=resolution).status_code == 200
    own = client.get("/support/requests", headers=as_("usr_cp")).json()["items"][0]
    assert own["status"] == "resolved" and own["resolution"] == resolution
    assert update(client, identifier, 3, "note", note="Cannot edit a closed case").status_code == 400
    assert update(client, identifier, 3, "reopen", note="New evidence requires a follow-up review.").status_code == 200
    detail = client.get(f"/admin/cases/{identifier}", headers=as_("usr_admin")).json()
    assert detail["status"] == "open" and detail["resolution"] is None
    assert [e["action"] for e in detail["events"]] == ["assign", "start", "resolved", "reopen"]
    assert detail["events"][2]["note"] == resolution
    assert client.get("/admin/overview", headers=as_("usr_admin")).json()["my_cases"] == 1
    assert client.get("/admin/cases?owner=mine", headers=as_("usr_admin")).json()["total"] == 1


@pytest.mark.parametrize("status", ["published", "development"])
def test_listing_moderation_preserves_the_record_and_requires_an_admin_to_restore(client, db, world, status):
    venture = world["venture"]
    venture.status = status
    db.commit()
    identifier = request(client, category="listing", venture_slug="test").json()["id"]
    assert update(client, identifier, 0, "hide_listing", note="Investigating the reported misleading listing information.").status_code == 200
    db.refresh(venture)
    assert venture.status == "draft" and venture.moderation_hold
    assert any("administrator" in problem for problem in check_publishable(venture))
    assert not any(row["venture"]["id"] == venture.id for row in client.get("/bench").json())
    assert update(client, identifier, 1, "restore_listing", note="The reported issue was reviewed and the listing can return.").status_code == 200
    db.refresh(venture)
    assert venture.status == status and not venture.moderation_hold
    detail = client.get(f"/admin/cases/{identifier}", headers=as_("usr_admin")).json()
    assert detail["events"][0]["previous_status"] == status


def test_private_listing_ids_and_invalid_requests_are_rejected(client, db, world):
    assert request(client, category="listing", venture_slug="missing").status_code == 404
    world["venture"].status = "draft"
    db.commit()
    assert request(client, category="listing", venture_slug="test").status_code == 404
    assert request(client, subject="     ").status_code == 422
    assert request(client, category="dispute").status_code == 422
    assert client.post("/support/requests", json={}).status_code == 401


def test_existing_disputes_appear_in_operations_and_internal_notes_stay_private(client, db, world):
    pairing = make_pairing(db)
    row = ReviewCase(id="case_existing", pairing_id=pairing.id, opened_by="usr_cp", message="Please review the reported performance evidence.", status="open", created_at=now_utc())
    db.add(row)
    db.commit()
    queue = client.get("/admin/cases?category=dispute", headers=as_("usr_admin")).json()
    assert queue["total"] == 1 and queue["items"][0]["venture"]["id"] == world["venture"].id
    assert update(client, row.id, 0, "note", note="Private moderation deliberations").status_code == 200
    details = client.get(f"/pairings/{pairing.id}/commercial", headers=as_("usr_cp")).json()
    assert "Private moderation" not in str(details) and "events" not in details["cases"][0]
    assert update(client, row.id, 1, "start").status_code == 200
    result = client.post(f"/review-cases/{row.id}/resolve", headers=as_("usr_admin"), json={"action": "resolve", "note": "Both parties reviewed the evidence and agreed next steps."})
    assert result.status_code == 200 and result.json()["version"] == 3
    assert "events" not in result.json()


def test_case_pagination_search_and_filters(client, db, world):
    for index in range(27):
        db.add(ReviewCase(id=f"case_{index:03}", opened_by="usr_cp", category="support", subject=f"Question {index:03}", message="A request with enough detail.", status="open", created_at=now_utc()))
    db.commit()
    first = client.get("/admin/cases", headers=as_("usr_admin")).json()
    second = client.get("/admin/cases?offset=25", headers=as_("usr_admin")).json()
    assert first["total"] == 27 and len(first["items"]) == 25 and len(second["items"]) == 2
    assert {row["id"] for row in first["items"]}.isdisjoint(row["id"] for row in second["items"])
    assert client.get("/admin/cases?q=Question%20001", headers=as_("usr_admin")).json()["total"] == 1
    assert client.get("/admin/cases?category=account", headers=as_("usr_admin")).json()["total"] == 0
    assert client.get("/admin/cases?status=unknown", headers=as_("usr_admin")).status_code == 422

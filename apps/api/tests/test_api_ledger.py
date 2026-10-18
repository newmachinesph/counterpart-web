"""Logging weeks, week-close immutability, comments, and permissions over HTTP."""
from tests.conftest import LAST_MONDAY, NEXT_MONDAY, THIS_MONDAY, as_, make_entry, make_pairing


def log(client, user_id, week=THIS_MONDAY, values=None, note="A week.", pairing="pair_test"):
    body = {"week_starting": week.isoformat(), "values": values or {"merchants_live": 4, "revenue_php": 3000}, "note": note, "evidence_links": []}
    return client.post(f"/pairings/{pairing}/ledger", json=body, headers=as_(user_id))


def test_the_counterpart_logs_the_week(client, db, world):
    make_pairing(db)
    r = log(client, "usr_cp")
    assert r.status_code == 200
    assert r.json()["week_starting"] == THIS_MONDAY.isoformat()
    assert r.json()["values"] == {"merchants_live": 4, "revenue_php": 3000}


def test_nobody_else_logs(client, db, world):
    make_pairing(db)
    for who in ("usr_builder", "usr_kaye", "usr_admin"):
        r = log(client, who)
        assert r.status_code == 403, who
        assert "Only the Counterpart" in r.json()["detail"] or "not yours" in r.json()["detail"]
    assert log(client, "usr_cp2").status_code == 403


def test_logging_twice_in_an_open_week_edits_the_same_entry(client, db, world):
    make_pairing(db)
    first = log(client, "usr_cp").json()
    second = log(client, "usr_cp", values={"merchants_live": 5, "revenue_php": 4000}, note="Corrected.").json()
    assert second["id"] == first["id"]
    assert second["submitted_at"] == first["submitted_at"]
    assert second["values"]["merchants_live"] == 5 and second["note"] == "Corrected."


def test_a_closed_week_is_read_only(client, db, world):
    make_pairing(db)
    r = log(client, "usr_cp", week=LAST_MONDAY)
    assert r.status_code == 409 and "read-only" in r.json()["detail"]


def test_a_future_week_and_a_non_monday_are_refused(client, db, world):
    make_pairing(db)
    assert log(client, "usr_cp", week=NEXT_MONDAY).status_code == 400
    from datetime import date
    assert "Monday" in log(client, "usr_cp", week=date(2026, 9, 8)).json()["detail"]


def test_values_must_match_the_ventures_metrics(client, db, world):
    make_pairing(db)
    assert log(client, "usr_cp", values={"merchants_live": 1}).status_code == 400
    assert "negative" in log(client, "usr_cp", values={"merchants_live": 1, "revenue_php": -5}).json()["detail"]
    assert "not a metric" in log(client, "usr_cp", values={"merchants_live": 1, "revenue_php": 1, "bogus": 2}).json()["detail"]


def test_logging_against_an_ended_pairing_is_refused(client, db, world):
    make_pairing(db, "pair_done", state="released")
    r = log(client, "usr_cp", pairing="pair_done")
    assert r.status_code == 400 and "ledger is closed" in r.json()["detail"]


def test_logging_clears_a_milestone_and_records_the_vesting(client, db, world):
    # Historical engagements are paused for documented review, never silently rewritten.
    make_pairing(db)
    log(client, "usr_cp", values={"merchants_live": 300, "revenue_php": 999999})
    d = client.get("/pairings/pair_test", headers=as_("usr_cp")).json()
    assert d["pairing"]["state"] == "proving_run"
    assert d["vesting"] == []
    assert [m["milestone"]["status"] for m in d["milestones"]] == ["locked", "locked"]


def test_only_the_builder_comments_and_never_on_the_numbers(client, db, world):
    make_pairing(db)
    entry = make_entry(db, "pair_test", LAST_MONDAY, {"merchants_live": 2, "revenue_php": 500})
    assert client.post(f"/ledger/{entry.id}/comments", json={"body": "Which two?"}, headers=as_("usr_cp")).status_code == 403
    assert client.post(f"/ledger/{entry.id}/comments", json={"body": "Reading."}, headers=as_("usr_kaye")).status_code == 403
    ok = client.post(f"/ledger/{entry.id}/comments", json={"body": "Which two?"}, headers=as_("usr_builder"))
    assert ok.status_code == 201 and ok.json()["body"] == "Which two?"
    db.refresh(entry)
    assert entry.values == {"merchants_live": 2, "revenue_php": 500}


def test_comments_refuse_empty_bodies_and_unknown_entries(client, db, world):
    make_pairing(db)
    entry = make_entry(db, "pair_test", LAST_MONDAY, {"merchants_live": 1, "revenue_php": 0})
    assert client.post(f"/ledger/{entry.id}/comments", json={"body": "   "}, headers=as_("usr_builder")).status_code == 400
    assert client.post("/ledger/nope/comments", json={"body": "Hi"}, headers=as_("usr_builder")).status_code == 404


def test_the_dashboard_shows_gaps_and_this_week(client, db, world):
    from datetime import timedelta
    started = THIS_MONDAY - timedelta(weeks=3)
    make_pairing(db, started_at=__import__("datetime").datetime(started.year, started.month, started.day, tzinfo=__import__("datetime").timezone.utc))
    make_entry(db, "pair_test", started, {"merchants_live": 1, "revenue_php": 0})
    make_entry(db, "pair_test", started + timedelta(weeks=2), {"merchants_live": 2, "revenue_php": 100})
    weeks = client.get("/pairings/pair_test", headers=as_("usr_cp")).json()["weeks"]
    assert [w["entry_id"] is not None for w in weeks] == [True, False, True, False]
    assert [w["closed"] for w in weeks] == [True, True, True, False]
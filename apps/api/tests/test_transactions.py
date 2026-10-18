import pytest
from sqlalchemy import select, update

from app.models import Application, LedgerEntry, OutboxEmail, Pairing, User
from app.services import applications, ledger, pairings
from tests.conftest import APPLICATION, NOW, THIS_MONDAY, make_pairing


def fail_sync(*args, **kwargs):
    raise RuntimeError("Milestone computation failed")


def test_failed_milestone_update_rolls_back_week(db, world, monkeypatch):
    pairing = make_pairing(db)
    monkeypatch.setattr(ledger, "sync", fail_sync)
    with pytest.raises(RuntimeError):
        ledger.log_week(db, db.get(User, "usr_cp"), pairing, THIS_MONDAY,
                        {"merchants_live": 3, "revenue_php": 100}, "", [], NOW)
    db.rollback()
    assert db.scalar(select(LedgerEntry)) is None


def test_failed_invitation_rolls_back_pairing_and_email(db, world, monkeypatch):
    application = applications.submit(db, db.get(User, "usr_cp"), world["venture"], APPLICATION, NOW)
    application_id = application.id
    monkeypatch.setattr(applications, "send_email", fail_sync)
    with pytest.raises(RuntimeError):
        applications.review(db, db.get(User, "usr_builder"), application_id, "invite", NOW)
    db.rollback()
    assert db.get(Application, application_id).status == "submitted"
    assert db.scalar(select(Pairing)) is None
    assert db.scalar(select(OutboxEmail)) is None


def test_end_refreshes_state_before_transition(db, world):
    pairing = make_pairing(db)
    # Simulate another request converting after this request loaded the pairing.
    db.execute(update(Pairing).where(Pairing.id == pairing.id).values(state="active", converted_at=NOW).execution_options(synchronize_session=False))
    db.commit()
    assert pairing.state == "proving_run"
    result = pairings.end(db, db.get(User, "usr_builder"), pairing, "Finished", NOW)
    assert result.state == "released"

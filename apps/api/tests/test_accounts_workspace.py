from datetime import timedelta

from sqlalchemy import select

from app.accounts import token_hash
from app.models import AccountCredential, AuthSession, User
from app.services.common import now_utc
from tests.conftest import as_, make_user, make_venture, make_pairing, make_entry, THIS_MONDAY

ACCOUNT = {"accept_platform_terms": True, "name": "Integration Builder", "email": "builder@example.test", "password": "integration-only-passphrase", "role": "builder"}


def test_registration_login_logout_and_password_storage(client, db):
    r = client.post("/auth/register", json=ACCOUNT)
    assert r.status_code == 201
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/me", headers=headers).json()
    assert me["roles"] == ["builder"]
    cred = db.get(AccountCredential, me["id"])
    assert cred.password_hash.startswith("scrypt$") and ACCOUNT["password"] not in cred.password_hash
    assert db.get(AuthSession, token_hash(token)) is not None
    assert client.get("/me", headers={"X-User-Id": me["id"]}).status_code == 401
    assert client.post("/auth/login", json={**ACCOUNT, "password": "incorrect-passphrase"}).status_code == 401
    assert client.post("/auth/login", json=ACCOUNT).status_code == 200
    assert client.post("/auth/register", json=ACCOUNT).status_code == 409
    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/me", headers=headers).status_code == 401


def test_registration_cannot_grant_privileged_roles(client):
    for role in ["admin", "investor"]:
        assert client.post("/auth/register", json={**ACCOUNT, "role": role}).status_code == 422


def test_expired_session(client, db):
    token = client.post("/auth/register", json=ACCOUNT).json()["token"]
    session = db.get(AuthSession, token_hash(token))
    session.expires_at = now_utc() - timedelta(seconds=1)
    db.commit()
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_empty_database_has_no_demo_content(client):
    state = client.get("/workspace")
    assert state.status_code == 200
    assert all(state.json()[key] == [] for key in ["users", "ventures", "pairings", "applications", "ledger_entries"])
    assert client.get("/bench").json() == []
    assert client.get("/jobs").json() == []
    assert client.get("/stats").json() == {"published": 0, "applications": 0, "pairings": 0, "weeks": 0, "revenue": 0, "vested": 0, "equity_records": 0}


def test_workspace_private_data_is_scoped(client, db):
    make_user(db, "owner", ["builder"])
    make_user(db, "partner", ["counterpart"])
    make_user(db, "outsider", ["builder"])
    make_venture(db, "ven_public", "owner")
    make_venture(db, "ven_secret", "owner", status="draft")
    make_pairing(db, "pair_private", "ven_public", "owner", "partner", started_at=now_utc())
    make_entry(db, "pair_private", THIS_MONDAY, {"revenue_php": 10})
    for headers in [{}, as_("outsider")]:
        data = client.get("/workspace", headers=headers).json()
        assert [v["id"] for v in data["ventures"]] == ["ven_public"]
        assert data["pairings"] == [] and data["ledger_entries"] == []
        assert next(u for u in data["users"] if u["id"] == "owner")["email"] == ""
    data = client.get("/workspace", headers=as_("owner")).json()
    assert len(data["ventures"]) == 2 and len(data["pairings"]) == 1
    assert data["ledger_entries"][0]["values"] == {"revenue_php": 10}


def test_existing_user_is_preserved(client, db):
    user = make_user(db, "existing", ["builder"])
    before = user.name
    assert client.post("/auth/register", json={**ACCOUNT, "email": user.email}).status_code == 409
    db.expire_all()
    assert db.get(User, "existing").name == before

import base64
import hashlib
import hmac
import json
import time
from datetime import timedelta
from io import BytesIO

import jwt
import pytest
from PIL import Image
from sqlalchemy import select, func

from app.config import settings
from app.models import ChatMessage, RealtimeEvent, VerificationSession, WebhookReceipt, OutboxEmail
from app.routers import assets
from app.services import metadata, realtime
from app.services.common import now_utc
from app import mail_worker
from tests.conftest import as_, make_user, make_venture, make_pairing


@pytest.fixture
def conversation(db):
    for name, roles in [("usr_builder", ["builder"]), ("usr_cp", ["counterpart"]), ("outsider", ["counterpart"]), ("investor", ["investor"]), ("admin", ["admin"])]:
        make_user(db, name, roles)
    make_venture(db)
    return make_pairing(db)


def test_chat_durable_private_and_idempotent(client, db, conversation):
    path = "/pairings/pair_test/messages"
    data = {"body": "Hello, let's start this week.", "client_id": "message-0001"}
    first = client.post(path, headers=as_("usr_cp"), json=data)
    assert first.status_code == 201
    assert client.post(path, headers=as_("usr_cp"), json=data).json()["id"] == first.json()["id"]
    assert db.scalar(select(func.count()).select_from(ChatMessage)) == 1
    assert db.scalar(select(func.count()).select_from(RealtimeEvent)) == 1
    assert len(client.get(path, headers=as_("usr_builder")).json()["messages"]) == 1
    for user in ("outsider", "investor"):
        assert client.get(path, headers=as_(user)).status_code == 403
        assert client.post(path, headers=as_(user), json=data).status_code == 403
        assert client.post("/realtime/token", headers=as_(user), json={"pairing_id": "pair_test"}).status_code == 403
    assert client.get(path).status_code == 401
    assert client.get(path, headers=as_("admin")).status_code == 200
    conversation.state = "released"; db.commit()
    assert client.get(path, headers=as_("usr_cp")).json()["read_only"]
    assert client.post(path, headers=as_("usr_cp"), json={**data, "client_id": "message-0002"}).status_code == 400


def test_chat_pagination_preserves_equal_timestamps(client, db, conversation):
    at = now_utc()
    for index in range(7):
        db.add(ChatMessage(id=f"m{index}", pairing_id=conversation.id, author_id="usr_cp", client_id=f"message{index}", body="test", created_at=at))
    db.commit()
    path = "/pairings/pair_test/messages"
    seen, cursor = [], None
    for _ in range(3):
        params = {"limit": 3}
        if cursor: params["before"] = cursor
        data = client.get(path, headers=as_("usr_cp"), params=params).json()
        seen += [m["id"] for m in data["messages"]]
        cursor = data["next_before"]
    assert len(seen) == len(set(seen)) == 7
    assert client.get(path, headers=as_("usr_cp"), params={"before": "bad"}).status_code == 400


def test_tokens_are_scoped_to_subscribe(monkeypatch):
    monkeypatch.setattr(settings, "ably_api_key", "test.key:secret")
    captured = {}
    class Response:
        def raise_for_status(self): pass
        def json(self): return {"token": "scoped"}
    def post(url, **kwargs): captured.update(kwargs); return Response()
    monkeypatch.setattr(realtime.httpx, "post", post)
    realtime.token_request("usr1", ["counterpart:qa:user:usr1"])
    assert captured["json"]["clientId"] == "usr1"
    assert abs(captured["json"]["timestamp"] - time.time() * 1000) < 2000
    assert len(captured["json"]["nonce"]) >= 16
    assert json.loads(captured["json"]["capability"]) == {"counterpart:qa:user:usr1": ["subscribe"]}


def test_optional_verification_disabled_does_not_call_provider(client, db, monkeypatch):
    make_user(db, "usr_cp", ["counterpart"])
    monkeypatch.setattr(settings, "verification_enabled", False)
    assert client.get("/verification", headers=as_("usr_cp")).json() == {"optional": True, "configured": False, "session": None}
    assert client.post("/verification/start", headers=as_("usr_cp")).status_code == 503


def signed_didit(data, secret):
    raw = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return raw, {"x-timestamp": str(data["timestamp"]), "x-signature-v2": hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest(), "content-type": "application/json"}


def test_verification_signed_idempotent_ordered(client, db, monkeypatch):
    make_user(db, "usr_cp", ["counterpart"])
    monkeypatch.setattr(settings, "didit_webhook_secret", "test-webhook-secret")
    db.add(VerificationSession(id="verify1", user_id="usr_cp", workflow_id="workflow1", status="Not Started", url="https://verify.didit.me/test", created_at=now_utc(), updated_at=now_utc()))
    db.commit()
    data = {"timestamp": int(time.time()), "created_at": 100, "event_id": "event1", "session_id": "verify1", "workflow_id": "workflow1", "vendor_data": "usr_cp", "webhook_type": "status.updated", "status": "Approved"}
    raw, headers = signed_didit(data, "test-webhook-secret")
    assert client.post("/webhooks/didit", content=raw, headers=headers).status_code == 200
    assert client.post("/webhooks/didit", content=raw, headers=headers).status_code == 200
    assert db.scalar(select(func.count()).select_from(WebhookReceipt)) == 1
    assert db.get(VerificationSession, "verify1").status == "Approved"
    # Authenticated older updates cannot overwrite a newer result.
    raw, headers = signed_didit({**data, "created_at": 99, "event_id": "older", "status": "Declined"}, "test-webhook-secret")
    assert client.post("/webhooks/didit", content=raw, headers=headers).status_code == 200
    assert db.get(VerificationSession, "verify1").status == "Approved"
    assert client.post("/webhooks/didit", content=raw.replace(b"Declined", b"Approved"), headers=headers).status_code == 401
    raw, headers = signed_didit({**data, "timestamp": int(time.time()) - 301}, "test-webhook-secret")
    assert client.post("/webhooks/didit", content=raw, headers=headers).status_code == 401


def job_signature(raw, key, **overrides):
    claims = {"iss": "Upstash", "sub": "https://api.counterpart.ph/webhooks/qstash/maintenance", "exp": int(time.time()) + 60,
        "nbf": int(time.time()) - 1, "jti": "test-job-1", "body": base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).decode().rstrip("=")}
    return jwt.encode({**claims, **overrides}, key, algorithm="HS256")


@pytest.mark.parametrize("key_name", ["qstash_current_signing_key", "qstash_next_signing_key"])
def test_qstash_signature_rotation_and_replay(client, db, monkeypatch, key_name):
    key = "a-long-test-signing-key-of-at-least-32-bytes"
    monkeypatch.setattr(settings, key_name, key)
    monkeypatch.setattr(settings, "qstash_callback_url", "https://api.counterpart.ph/webhooks/qstash/maintenance")
    raw = b'{}'; headers = {"upstash-signature": job_signature(raw, key)}
    path = "/webhooks/qstash/maintenance"
    assert client.post(path, content=raw, headers=headers).status_code == 200
    assert client.post(path, content=raw, headers=headers).json()["duplicate"]
    assert client.post(path, content=b'{"changed":true}', headers=headers).status_code == 401
    assert client.post(path, content=raw, headers={"upstash-signature": job_signature(raw, key, sub="https://evil.example")}).status_code == 401
    assert client.post(path, content=raw).status_code == 401


def test_images_are_validated_reencoded_and_private_to_writers(client, db, monkeypatch):
    make_user(db, "builder", ["builder"]); make_user(db, "counterpart", ["counterpart"])
    stored = {}
    class Storage:
        def put_object(self, **kwargs): stored.update(kwargs)
    monkeypatch.setattr(assets, "storage", lambda: Storage())
    source = BytesIO(); Image.new("RGB", (90, 30), "blue").save(source, format="PNG")
    file = {"file": ("wide.png", source.getvalue(), "image/png")}
    assert client.post("/assets", headers=as_("counterpart"), files=file).status_code == 403
    response = client.post("/assets", headers=as_("builder"), files=file)
    assert response.status_code == 201
    assert stored["ContentType"] == "image/webp"
    assert Image.open(BytesIO(stored["Body"])).size == (90, 30)
    assert client.post("/assets", headers=as_("builder"), files={"file": ("bad.png", b"<script>bad</script>", "image/png")}).status_code == 422
    assert client.post("/assets", headers=as_("builder"), files={"file": ("large.png", b"x" * (assets.MAX_BYTES + 1), "image/png")}).status_code == 413


def test_email_schedule_retry_cancel_admin_only(client, db, monkeypatch):
    make_user(db, "admin", ["admin"]); make_user(db, "cp", ["counterpart"])
    path = "/admin/email-queue"
    monkeypatch.setattr(settings, "smtp_host", "mail")
    sent = []; monkeypatch.setattr(mail_worker, "deliver", lambda mail: sent.append(mail.id))
    body = {"to": "queue@example.test", "subject": "Scheduled", "body": "Later", "send_at": (now_utc() + timedelta(hours=1)).isoformat()}
    assert client.post(path, json=body, headers=as_("cp")).status_code == 403
    message = client.post(path, json=body, headers=as_("admin")).json()
    assert message["status"] == "scheduled"
    assert not mail_worker.dispatch_one(db)
    assert client.post(path + "/" + message["id"] + "/cancel", headers=as_("admin")).json()["status"] == "cancelled"
    assert not mail_worker.dispatch_one(db)
    assert client.post(path + "/" + message["id"] + "/retry", headers=as_("admin")).status_code == 200
    assert mail_worker.dispatch_one(db) and sent == [message["id"]]
    assert client.post(path + "/" + message["id"] + "/retry", headers=as_("admin")).status_code == 409
    assert client.post(path, json={**body, "send_at": "2026-10-01T10:00:00"}, headers=as_("admin")).status_code == 422


def test_metadata_extracts_relative_images_and_preserves_urls(monkeypatch):
    monkeypatch.setattr(metadata, "public_address", lambda *args: "8.8.8.8")
    data = metadata.parse_metadata('<meta property="og:image" content="/og.png"><link rel="apple-touch-icon" href="/logo.png"><meta name="description" content="Useful app">', "https://example.com/project")
    assert data["image"] == "https://example.com/og.png"
    assert data["logo"] == "https://example.com/logo.png"
    assert metadata.safe_url("https://example.com", "javascript:alert(1)") is None


@pytest.mark.parametrize("url", ["http://localhost", "http://127.0.0.1", "http://169.254.169.254/latest", "http://[::1]", "file:///etc/passwd", "https://example.com:8000"])
def test_metadata_blocks_internal_requests(url):
    with pytest.raises((ValueError, OSError)):
        metadata.fetch_metadata(url)

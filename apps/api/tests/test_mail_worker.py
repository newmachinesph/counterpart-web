import smtplib
from datetime import timedelta

from sqlalchemy import select

from app import mail_worker
from app.models import OutboxEmail
from app.services.common import now_utc
from app.services.notifications import send_email


def test_dispatch_only_new_mail_and_record_delivery(db, monkeypatch):
    monkeypatch.setattr(mail_worker.settings, "smtp_host", "mail")
    delivered = []
    monkeypatch.setattr(mail_worker, "deliver", lambda message: delivered.append(message.to))
    db.add(OutboxEmail(id="legacy", to="historic@example.test", subject="Old", body="Old", sent_at=now_utc()))
    send_email(db, "new@example.test", "New", "New")
    db.commit()
    assert mail_worker.dispatch_one(db)
    assert not mail_worker.dispatch_one(db)
    assert delivered == ["new@example.test"]
    assert db.get(OutboxEmail, "legacy").delivered_at is None
    message = db.scalar(select(OutboxEmail).where(OutboxEmail.to == "new@example.test"))
    assert message.delivered_at and message.attempts == 1


def test_failed_smtp_retries_without_losing_message(db, monkeypatch):
    monkeypatch.setattr(mail_worker.settings, "smtp_host", "mail")
    def failure(message):
        raise smtplib.SMTPException("Temporary failure")
    monkeypatch.setattr(mail_worker, "deliver", failure)
    send_email(db, "retry@example.test", "Retry", "Keep me")
    db.commit()
    assert mail_worker.dispatch_one(db)
    message = db.scalar(select(OutboxEmail))
    assert message.delivered_at is None and message.last_error == "SMTPException"
    assert message.dispatch_after > now_utc()
    assert not mail_worker.dispatch_one(db)
    message.dispatch_after = now_utc() - timedelta(seconds=1)
    db.commit()
    monkeypatch.setattr(mail_worker, "deliver", lambda message: None)
    assert mail_worker.dispatch_one(db)
    assert message.delivered_at and message.attempts == 2 and message.last_error is None

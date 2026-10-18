"""Transactional outbox dispatcher. Run separately: python -m app.mail_worker.

At-least-once delivery: a crash after SMTP accepts but before commit can retry.
The stable Message-ID lets mail systems identify those retries.
Historical outbox records have no dispatch_after and are never replayed.
"""
import logging
import smtplib
import ssl
import time
from datetime import timedelta
from email.message import EmailMessage
from email.utils import parseaddr

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.models import OutboxEmail
from app.services.common import now_utc
from app.services.realtime import dispatch_one as dispatch_realtime


def deliver(message: OutboxEmail) -> None:
    email = EmailMessage()
    email["From"] = settings.smtp_from
    email["To"] = message.to
    email["Subject"] = message.subject
    sender_domain = parseaddr(settings.smtp_from)[1].split("@")[-1]
    email["Message-ID"] = f"<{message.id}@{sender_domain}>"
    email.set_content(message.body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_starttls:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(email)


def dispatch_one(db: Session) -> bool:
    if not settings.smtp_host:
        return False
    message = db.scalar(select(OutboxEmail).where(
        OutboxEmail.delivered_at.is_(None), OutboxEmail.dispatch_after <= now_utc(),
        OutboxEmail.attempts < 10,
    ).order_by(OutboxEmail.sent_at).limit(1).with_for_update(skip_locked=True))
    if message is None:
        db.rollback()
        return False
    message.attempts += 1
    try:
        deliver(message)
        message.delivered_at = now_utc()
        message.last_error = None
    except (OSError, smtplib.SMTPException, ValueError) as error:
        message.last_error = type(error).__name__
        message.dispatch_after = now_utc() + timedelta(seconds=min(3600, 30 * 2 ** message.attempts))
    db.commit()
    return True


def main():
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            with SessionLocal() as db:
                busy = dispatch_one(db)
            with SessionLocal() as db:
                busy = dispatch_realtime(db) or busy
        except Exception:
            logging.exception("Mail dispatcher failed; retrying")
            busy = False
        if not busy:
            time.sleep(5)


if __name__ == "__main__":
    main()

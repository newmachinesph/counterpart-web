"""Password credentials and opaque, revocable PostgreSQL sessions."""
import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AccountCredential, AccountToken, AuthSession, User
from app.domain.contracts import PLATFORM_VERSION
from app.services.notifications import send_email
from app.config import settings
from app.services.common import new_id, now_utc
from app.services.rate_limit import check as rate_limit

router = APIRouter(prefix="/auth", tags=["accounts"])


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${digest}"


def password_matches(password: str, encoded: str) -> bool:
    return hmac.compare_digest(password_hash(password, encoded.split("$")[1]), encoded)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class LoginIn(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def email_address(cls, value: str) -> str:
        value = value.strip().lower()
        if not value or "@" not in value or "." not in value.rsplit("@", 1)[-1] or any(c.isspace() for c in value):
            raise ValueError("Enter a valid email address")
        return value


class RegisterIn(LoginIn):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(pattern=r"^(builder|counterpart)$")
    accept_platform_terms: bool = False


def issue_session(db: Session, user: User) -> dict:
    token = secrets.token_urlsafe(48)
    db.add(AuthSession(token_hash=token_hash(token), user_id=user.id, expires_at=now_utc() + timedelta(days=14)))
    db.commit()
    return {"token": token, "expires_in": 1209600}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    rate_limit("register", body.email, 5)
    if not body.accept_platform_terms:
        raise HTTPException(422, "Accept the platform terms and read the privacy notice before registering")
    if len(body.name.strip()) < 2:
        raise HTTPException(422, "Enter your name")
    if db.scalar(select(User.id).where(func.lower(User.email) == body.email)):
        raise HTTPException(409, "An account already exists for this email. Sign in instead.")
    user = User(id=new_id("usr"), name=body.name.strip(), email=body.email, roles=[body.role], platform_terms_version=PLATFORM_VERSION)
    try:
        db.add(user)
        db.flush()
        db.add(AccountCredential(user_id=user.id, password_hash=password_hash(body.password)))
        queue_token(db, user, "verify")
        return issue_session(db, user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account already exists for this email. Sign in instead.")


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    rate_limit("login", body.email, 15)
    user = db.scalar(select(User).where(func.lower(User.email) == body.email))
    credential = db.get(AccountCredential, user.id) if user else None
    encoded = credential.password_hash if credential else password_hash("unavailable-account-password", "00" * 16)
    valid = password_matches(body.password, encoded)
    if not credential or not valid:
        raise HTTPException(401, "Email or password is incorrect")
    return issue_session(db, user)


def queue_token(db, user, purpose):
    token = secrets.token_urlsafe(40)
    db.add(AccountToken(token_hash=token_hash(token), user_id=user.id, purpose=purpose,
        expires_at=now_utc() + timedelta(minutes=60 if purpose == "reset" else 1440)))
    path = "/account/reset" if purpose == "reset" else "/account/verify"
    send_email(db, user.email, "Reset your Counterpart password" if purpose == "reset" else "Verify your Counterpart email",
        f"Open this link to {'reset your password' if purpose == 'reset' else 'verify your email'}:\n{settings.web_url}{path}?token={token}\n\nIf you did not request this, ignore this message.")


class EmailIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)


@router.post("/forgot-password")
def forgot(body: EmailIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    rate_limit("recovery", email, 3, 3600)
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user:
        queue_token(db, user, "reset")
        db.commit()
    return {"message": "If an account matches, a password reset link has been queued."}


class TokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=150)
    password: str | None = Field(default=None, min_length=12, max_length=128)


def consume_token(db, token, purpose):
    row = db.scalar(select(AccountToken).where(AccountToken.token_hash == token_hash(token)).with_for_update())
    if not row or row.purpose != purpose or row.used_at or row.expires_at <= now_utc():
        raise HTTPException(400, "This link is invalid or expired. Request another link.")
    row.used_at = now_utc()
    return db.get(User, row.user_id)


@router.post("/reset-password")
def reset_password(body: TokenIn, db: Session = Depends(get_db)):
    if not body.password:
        raise HTTPException(422, "Enter a new password")
    user = consume_token(db, body.token, "reset")
    db.refresh(user, with_for_update=True)
    credential = db.get(AccountCredential, user.id)
    if not credential:
        raise HTTPException(400, "This account does not use password login")
    credential.password_hash = password_hash(body.password)
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.execute(delete(AccountToken).where(AccountToken.user_id == user.id, AccountToken.purpose == "reset"))
    db.commit()
    return {"message": "Password changed. Sign in again; previous sessions have been revoked."}


@router.post("/verify-email")
def verify_email(body: TokenIn, db: Session = Depends(get_db)):
    user = consume_token(db, body.token, "verify")
    user.email_verified_at = now_utc()
    db.commit()
    return {"message": "Email verified. You can now make and accept offers."}


@router.post("/resend-verification")
def resend_verification(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    from app.auth import optional_user
    user = optional_user(authorization, db)
    if not user:
        raise HTTPException(401, "Sign in first")
    rate_limit("verification-email", user.id, 3, 3600)
    if not user.email_verified_at:
        queue_token(db, user, "verify")
        db.commit()
    return {"message": "Check your inbox for the verification link."}

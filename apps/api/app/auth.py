from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuthSession, User
from app.accounts import token_hash
from app.services.common import now_utc


def optional_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    session = db.get(AuthSession, token_hash(token)) if scheme.lower() == "bearer" and token else None
    if not session or session.expires_at <= now_utc():
        raise HTTPException(401, "Your session has expired. Sign in again.")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "Sign in first")
    return user


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(401, "Sign in first")
    return user


def require_role(role: str):
    def dep(user: User = Depends(current_user)) -> User:
        if role not in user.roles and "admin" not in user.roles:
            raise HTTPException(status_code=403, detail=f"Needs the {role} role")
        return user

    return dep

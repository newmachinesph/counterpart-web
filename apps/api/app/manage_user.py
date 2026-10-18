"""Interactive local operator tool for existing accounts and privileged roles."""
import argparse
from getpass import getpass

from sqlalchemy import delete, func, select

from app.accounts import LoginIn, password_hash
from app.db import SessionLocal
from app.models import AccountCredential, AuthSession, User
from app.services.common import new_id


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    parser.add_argument("--name", help="Required only for a new account")
    parser.add_argument("--role", action="append", choices=["builder", "counterpart", "investor", "admin"], help="Add a role; existing roles are preserved")
    args = parser.parse_args()
    password = getpass("New password (12–128 characters): ")
    if password != getpass("Confirm password: "):
        parser.error("Passwords did not match")
    validated = LoginIn(email=args.email, password=password)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(func.lower(User.email) == validated.email))
        if user is None:
            if not args.name or not args.role:
                parser.error("New accounts require --name and at least one --role")
            user = User(id=new_id("usr"), name=args.name.strip(), email=validated.email, roles=args.role)
            db.add(user)
            db.flush()
        elif args.role:
            user.roles = sorted(set(user.roles) | set(args.role))
        user.email = validated.email
        credential = db.get(AccountCredential, user.id)
        if credential:
            credential.password_hash = password_hash(password)
        else:
            db.add(AccountCredential(user_id=user.id, password_hash=password_hash(password)))
        db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
        db.commit()
        print("Account updated. Existing sessions revoked; venture and pairing data preserved.")


if __name__ == "__main__":
    main()

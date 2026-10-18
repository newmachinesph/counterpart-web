import secrets
from datetime import datetime, timezone


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class NotFound(Exception):
    pass


class Forbidden(Exception):
    pass


class Validation(Exception):
    pass
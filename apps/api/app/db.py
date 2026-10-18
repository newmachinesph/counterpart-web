from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# The Postgres cluster is shared with seven other apps and allows ~19 connections
# in total. The default (5 held, 15 at burst) in both the API and the mail worker
# overbooks it and locks the others out (53300). Hold one, burst to three.
engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=1, max_overflow=2)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    s = get_settings()
    return create_engine(
        s.database_url,
        pool_pre_ping=True,
        # PgBouncer-style poolers (Supabase pooler, transaction mode) cannot
        # keep server-side prepared statements across transactions; disabling
        # them is harmless on a direct connection.
        connect_args={"prepare_threshold": None},
        pool_size=s.db_pool_size,
        max_overflow=s.db_max_overflow,
    )


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    # expire_on_commit=False: explicit units of work; objects stay readable after commit.
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """One session per request. Routes commit explicitly; close() rolls back anything else."""
    db = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()

import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DB
from app.core.errors import AppError

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger("reservehub.health")


@router.get("/live", summary="Liveness probe")
def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe (checks the database)")
def ready(db: DB) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("readiness_failed", exc_info=exc)
        raise AppError(
            "Database is unavailable.", code="database_unavailable", status_code=503
        ) from exc
    return {"status": "ready"}

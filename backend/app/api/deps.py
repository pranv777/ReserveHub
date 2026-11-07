import uuid
from typing import Annotated, Any

from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import verify_access_token
from app.db.session import get_db
from app.models.profile import ROLE_ADMIN, Profile

bearer = HTTPBearer(auto_error=False, description="Supabase access token")

DB = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> Profile:
    if creds is None:
        raise UnauthorizedError("Authentication is required.")
    claims = verify_access_token(creds.credentials)
    try:
        user_id = uuid.UUID(str(claims["sub"]))
    except ValueError as exc:
        raise UnauthorizedError("The access token is invalid.", code="invalid_token") from exc

    profile = db.get(Profile, user_id)
    if profile is None:
        # First request from a new Auth user. Role is NOT taken from claims: always 'member'.
        meta = claims.get("user_metadata") or {}
        name = meta.get("display_name") if isinstance(meta, dict) else None
        db.execute(
            pg_insert(Profile)
            .values(
                id=user_id,
                email=claims.get("email"),
                display_name=name[:120] if isinstance(name, str) else None,
            )
            .on_conflict_do_nothing(index_elements=["id"])
        )
        db.commit()
        profile = db.get(Profile, user_id)
    if profile is None or not profile.is_active:
        raise ForbiddenError("This account is disabled.", code="account_disabled")
    return profile


CurrentUser = Annotated[Profile, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> Profile:
    if user.role != ROLE_ADMIN:
        raise ForbiddenError("Administrator permission is required.", code="admin_required")
    return user


AdminUser = Annotated[Profile, Depends(require_admin)]

PageParam = Annotated[int, Query(ge=1, le=100000)]
PageSizeParam = Annotated[int, Query(ge=1, le=100)]

COMMON_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"description": "Missing, invalid or expired token"},
    403: {"description": "Not permitted"},
    404: {"description": "Not found"},
    409: {"description": "State conflict"},
    422: {"description": "Validation error"},
}

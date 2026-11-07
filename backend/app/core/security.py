"""Access-token verification (Supabase Auth JWTs).

The API validates every token itself: signature, expiry, audience (and issuer if
configured). Identity comes only from the verified ``sub`` claim. Roles are NEVER read
from token claims; they come from the ``profiles`` table.
"""

from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient

from app.core.config import get_settings
from app.core.errors import AppError, UnauthorizedError


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True)


def verify_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    options = {"require": ["exp", "sub"]}
    kwargs: dict[str, Any] = {"audience": settings.jwt_audience, "options": options}
    if settings.jwt_issuer:
        kwargs["issuer"] = settings.jwt_issuer
    try:
        if settings.supabase_jwks_url:
            key = _jwks_client(settings.supabase_jwks_url).get_signing_key_from_jwt(token).key
            return jwt.decode(token, key, algorithms=["RS256", "ES256"], **kwargs)
        if settings.supabase_jwt_secret:
            return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], **kwargs)
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("The access token has expired.", code="token_expired") from exc
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        raise UnauthorizedError("The access token is invalid.", code="invalid_token") from exc
    raise AppError("Authentication is not configured on the server.", code="auth_not_configured")

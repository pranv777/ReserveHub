from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://reservehub:reservehub@localhost:5432/reservehub"
    db_pool_size: int = 20
    db_max_overflow: int = 30

    # Comma separated explicit origins. Never "*" (credentials/Authorization are used).
    cors_origins: str = "http://localhost:5173"

    # Auth: set EITHER the JWKS URL (asymmetric keys, preferred) OR the HS256 secret.
    supabase_jwks_url: str | None = None
    supabase_jwt_secret: str | None = None
    jwt_audience: str = "authenticated"
    jwt_issuer: str | None = None

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, v: str) -> str:
        """Accept provider URLs (Supabase/Render give postgres:// or postgresql://) as-is."""
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix) :]
        return v

    max_page_size: int = 100
    max_request_bytes: int = 1_000_000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip() and o.strip() != "*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()

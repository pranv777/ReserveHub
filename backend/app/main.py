import logging
import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging, request_id_ctx

logger = logging.getLogger("reservehub")
_RID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

HTTP_CODES = {
    400: "bad_request",
    401: "not_authenticated",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    413: "payload_too_large",
    429: "rate_limited",
}


def error_response(
    status: int, code: str, message: str, details=None, headers=None
) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message, "request_id": request_id_ctx.get()}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(body, status_code=status, headers=headers)


class RequestContextMiddleware:
    """Pure ASGI middleware: correlation id, request log line, request size limit."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
        incoming = headers.get("x-request-id", "")
        rid = incoming if _RID_RE.match(incoming) else uuid.uuid4().hex
        request_id_ctx.set(rid)
        start = time.perf_counter()
        status = 500

        async def send_wrapper(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message["headers"] = [*message.get("headers", []), (b"x-request-id", rid.encode())]
            await send(message)

        try:
            length = headers.get("content-length")
            if length and length.isdigit() and int(length) > get_settings().max_request_bytes:
                status = 413
                resp = error_response(413, "payload_too_large", "Request body is too large.")
                await resp(scope, receive, send_wrapper)
                return
            await self.app(scope, receive, send_wrapper)
        finally:
            logger.info(
                "request",
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                },
            )


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title="ReserveHub API",
        version="0.1.0",
        description="Resource booking and waitlist API. Authenticate with a Supabase access token "
        "(`Authorization: Bearer ...`). Errors use `{error:{code,message,request_id}}`.",
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        if exc.status_code >= 500:
            logger.error("app_error", extra={"code": exc.code})
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return error_response(exc.status_code, exc.code, exc.message, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]}
            for e in exc.errors()
        ]
        return error_response(422, "validation_error", "Request validation failed.", details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = HTTP_CODES.get(exc.status_code, "http_error")
        return error_response(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception):
        logger.error("unhandled_exception", exc_info=exc)
        return error_response(500, "internal_error", "An unexpected error occurred.")

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()

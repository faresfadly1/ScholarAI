import json
import logging
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import analyses, auth, documents, profile, scholarships
from app.core.config import settings
from app.db.session import engine

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("scholarai")


@asynccontextmanager
async def lifespan(app):
    if settings.environment == "production":
        base_requirements = (
            settings.app_url.startswith("https://")
            and settings.storage_backend == "s3"
        )
        free_requirements = (
            settings.free_deployment_mode
            and not settings.redis_url
            and settings.task_mode == "local"
            and settings.database_url.startswith("postgresql+")
            and bool(settings.internal_proxy_secret)
        )
        paid_requirements = (
            not settings.free_deployment_mode
            and bool(settings.redis_url)
            and settings.task_mode == "celery"
            and bool(settings.smtp_host)
            and settings.llm_provider == "openai-compatible"
        )
        if not base_requirements or not (free_requirements or paid_requirements):
            raise RuntimeError(
                "Production requires HTTPS and private storage plus either FREE_DEPLOYMENT_MODE "
                "with PostgreSQL and local jobs, or the configured paid task architecture"
            )
    yield


app = FastAPI(title="ScholarAI API", version="0.1.0", lifespan=lifespan)
for router in [auth.router, profile.router, documents.router, scholarships.router, analyses.router]:
    app.include_router(router)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = str(uuid4())
    start = time.monotonic()
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and origin != settings.app_url:
            return JSONResponse(
                {"detail": "Cross-origin mutation blocked", "request_id": request_id},
                status_code=403,
            )
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Cross-site mutation blocked"}, status_code=403)
    length = request.headers.get("content-length")
    if length and int(length) > (settings.max_upload_mb + 1) * 1024 * 1024:
        return JSONResponse({"detail": "Request is too large"}, status_code=413)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    logger.info(
        json.dumps(
            {
                "event": "request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round((time.monotonic() - start) * 1000),
            }
        )
    )
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.error(json.dumps({"event": "request_error", "error_type": type(exc).__name__}))
    return JSONResponse({"detail": "Something went wrong. Please retry."}, status_code=500)


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "scholarai", "version": "0.1.0"}


@app.get("/ready")
@app.get("/api/ready")
def ready():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1 FROM users LIMIT 1"))
        if settings.redis_url:
            from app.core.limits import redis_client

            redis_client.ping()
        if settings.storage_backend == "s3":
            from app.services.storage import storage

            storage.client.head_bucket(Bucket=settings.s3_bucket)
        return {
            "status": "ready",
            "task_mode": settings.task_mode,
            "ai_provider": settings.llm_provider,
        }
    except Exception:
        return JSONResponse({"status": "not ready"}, status_code=503)

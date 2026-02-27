"""Nifty by Paragon — FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.pymongo import PymongoInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

from app.config import settings
from app.db import connect_db, disconnect_db
from app.telemetry import setup_telemetry
from app.routers import auth, users, organizations, content, classes
from app.utils.security import hash_password
from app.migrations import run_migrations

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    force=True,
)
# Suppress uvicorn's built-in access log — we emit our own below
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

def _seed_platform() -> None:
    """Ensure the internal 'nifty' organization and its super_admin exist."""
    from app.models.organization import Organization
    from app.models.user import User

    org = Organization.objects(slug="nifty").first()
    if not org:
        org = Organization(
            name="Nifty",
            slug="nifty",
            type="platform",
            internal=True,
        )
        org.save()
        logger.info("Platform org 'nifty' created")

    # Ensure the org is marked internal (idempotent fix for existing data)
    if not org.internal:
        org.internal = True
        org.save()

    existing_admin = User.objects(email=settings.superadmin_email).first()
    if not existing_admin:
        User(
            name="Super Admin",
            email=settings.superadmin_email,
            password_hash=hash_password(settings.superadmin_password),
            role="super_admin",
            org=org,
            avatar="SA",
            verified=True,
        ).save()
        logger.info("Seed super_admin created", extra={"email": settings.superadmin_email})
    elif not existing_admin.verified:
        existing_admin.verified = True
        existing_admin.save()
        logger.info("Seed super_admin verified (idempotent fix)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    setup_telemetry()
    PymongoInstrumentor().instrument()
    RedisInstrumentor().instrument()
    connect_db()
    _seed_platform()
    run_migrations()
    logger.info("Nifty backend started", extra={"env": settings.app_env})
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    disconnect_db()
    logger.info("Nifty backend stopped")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Access log middleware ─────────────────────────────────────────────────────
@app.middleware("http")
async def _access_log(request: Request, call_next):
    response = await call_next(request)
    logger.info("%s %s → %d", request.method, request.url.path, response.status_code)
    return response


# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── OpenTelemetry FastAPI instrumentation ────────────────────────────────────
FastAPIInstrumentor.instrument_app(app)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api/v1")
app.include_router(users.router,         prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(content.router,       prefix="/api/v1")
app.include_router(classes.router,       prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": settings.app_name}

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select, text

from app.api import accounts, activity, auth, automations, contacts, webhooks
from app.api import settings as settings_api
from app.config import get_settings
from app.db import SessionLocal
from app.models import User
from app.security import hash_password

log = logging.getLogger("app")


async def ensure_admin() -> None:
    """Create the dashboard login from ADMIN_EMAIL / ADMIN_PASSWORD on first start."""
    settings = get_settings()
    async with SessionLocal() as session:
        if await session.scalar(select(func.count()).select_from(User)):
            return
        session.add(
            User(email=settings.admin_email, password_hash=hash_password(settings.admin_password))
        )
        await session.commit()
        log.info("Created admin user %s", settings.admin_email)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.is_production and "change-me" in (settings.secret_key, settings.admin_password):
        raise RuntimeError("Set SECRET_KEY and ADMIN_PASSWORD in .env before running in production")
    await ensure_admin()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="FlowDM",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/api/docs",
        openapi_url=None if settings.is_production else "/api/openapi.json",
        redoc_url=None,
    )
    for module in (auth, accounts, automations, contacts, activity, settings_api, webhooks):
        app.include_router(module.router)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, bool]:
        async with SessionLocal() as session:
            await session.execute(text("select 1"))
        return {"ok": True}

    # Optional: serve the built dashboard when running without Caddy (e.g. local `uvicorn`)
    static_dir = Path(settings.static_dir) if settings.static_dir else None
    if static_dir and (static_dir / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str) -> FileResponse:
            file = static_dir / path
            if path and file.is_file() and static_dir in file.resolve().parents:
                return FileResponse(file)
            return FileResponse(static_dir / "index.html")

    return app


app = create_app()

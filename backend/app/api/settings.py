import re
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from app.api.deps import SessionDep, UserDep
from app.app_settings import load_instagram_config, save_values
from app.config import get_settings

router = APIRouter(tags=["settings"])


class InstagramAppIn(BaseModel):
    """Omit a field (or send null) to keep it; send "" to clear it."""

    instagram_app_id: str | None = None
    instagram_app_secret: str | None = None
    meta_app_secret: str | None = None

    @field_validator("instagram_app_id")
    @classmethod
    def _app_id(cls, value: str | None) -> str | None:
        if value and not re.fullmatch(r"\d{5,30}", value.strip()):
            raise ValueError("The Instagram app ID is a number (digits only)")
        return value

    @field_validator("instagram_app_secret", "meta_app_secret")
    @classmethod
    def _secret(cls, value: str | None) -> str | None:
        if value and not re.fullmatch(r"[A-Za-z0-9]{16,128}", value.strip()):
            raise ValueError("That doesn't look like an app secret (letters and digits only)")
        return value


async def _instagram_app_out(session: SessionDep) -> dict[str, Any]:
    app = await load_instagram_config(session)
    return {
        "instagram_app_id": app.app_id,
        "instagram_app_secret_set": bool(app.app_secret),
        "meta_app_secret_set": bool(app.meta_app_secret),
        "configured": app.configured,
    }


@router.get("/api/config")
async def config(_: UserDep, session: SessionDep) -> dict[str, Any]:
    settings = get_settings()
    base = settings.public_base_url.rstrip("/")
    app = await load_instagram_config(session)
    return {
        "public_base_url": base,
        "webhook_url": f"{base}/webhooks/instagram",
        "webhook_verify_token": settings.webhook_verify_token,
        "oauth_redirect_uri": settings.oauth_redirect_uri,
        "instagram_app_configured": app.configured,
        "graph_api_version": settings.graph_api_version,
    }


@router.get("/api/settings/instagram")
async def get_instagram_app(_: UserDep, session: SessionDep) -> dict[str, Any]:
    return await _instagram_app_out(session)


@router.put("/api/settings/instagram")
async def update_instagram_app(
    body: InstagramAppIn, _: UserDep, session: SessionDep
) -> dict[str, Any]:
    await save_values(session, body.model_dump())
    await session.commit()
    return await _instagram_app_out(session)

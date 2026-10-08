"""Instagram app credentials, editable from the dashboard (falling back to .env).

This lets someone deploy the server first and paste the Meta app's ID/secret in later,
without touching files on the server.
"""

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import AppSetting
from app.security import decrypt_secret, encrypt_secret

log = logging.getLogger(__name__)

EDITABLE_KEYS = ("instagram_app_id", "instagram_app_secret", "meta_app_secret")
SECRET_KEYS = {"instagram_app_secret", "meta_app_secret"}


@dataclass(frozen=True)
class InstagramAppConfig:
    app_id: str
    app_secret: str
    meta_app_secret: str

    @property
    def configured(self) -> bool:
        return bool(self.app_id and self.app_secret)

    @property
    def webhook_secrets(self) -> list[str]:
        # Meta's docs and real deliveries disagree on which secret signs webhooks: accept both
        return [s for s in (self.app_secret, self.meta_app_secret) if s]


async def _stored_values(session: AsyncSession) -> dict[str, str]:
    rows = await session.scalars(select(AppSetting).where(AppSetting.key.in_(EDITABLE_KEYS)))
    values: dict[str, str] = {}
    for row in rows:
        if row.key in SECRET_KEYS:
            try:
                values[row.key] = decrypt_secret(row.value)
            except ValueError:
                log.error("Stored %s can't be decrypted (SECRET_KEY changed?)", row.key)
                continue
        else:
            values[row.key] = row.value
    return values


async def load_instagram_config(session: AsyncSession) -> InstagramAppConfig:
    stored = await _stored_values(session)
    env = get_settings()
    return InstagramAppConfig(
        app_id=stored.get("instagram_app_id") or env.instagram_app_id,
        app_secret=stored.get("instagram_app_secret") or env.instagram_app_secret,
        meta_app_secret=stored.get("meta_app_secret") or env.meta_app_secret,
    )


async def save_values(session: AsyncSession, values: dict[str, str | None]) -> None:
    """None = leave unchanged, "" = remove (fall back to .env), anything else = store."""
    for key, value in values.items():
        if key not in EDITABLE_KEYS or value is None:
            continue
        row = await session.get(AppSetting, key)
        value = value.strip()
        if not value:
            if row is not None:
                await session.delete(row)
            continue
        stored = encrypt_secret(value) if key in SECRET_KEYS else value
        if row is None:
            session.add(AppSetting(key=key, value=stored))
        else:
            row.value = stored

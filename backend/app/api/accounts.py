import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import SessionDep, UserDep, get_account_or_404
from app.config import get_settings
from app.instagram import client as ig
from app.models import IGAccount
from app.schemas import AccountOut
from app.security import (
    create_state_token,
    decrypt_secret,
    encrypt_secret,
    verify_state_token,
)

log = logging.getLogger(__name__)
router = APIRouter(tags=["accounts"])

DEFAULT_TOKEN_LIFETIME = timedelta(days=60)


class TokenIn(BaseModel):
    access_token: str


class AccountPatch(BaseModel):
    is_active: bool


def _client(account: IGAccount) -> ig.InstagramClient:
    return ig.InstagramClient(decrypt_secret(account.access_token_enc), account.ig_user_id)


async def _save_account(session: SessionDep, token: str, expires_in: int | None) -> IGAccount:
    """Look up who the token belongs to, store it, and subscribe to webhooks."""
    try:
        me = await ig.InstagramClient(token, "me").get_me()
    except ig.InstagramAPIError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Instagram rejected the token: {exc}"
        ) from exc
    ig_user_id = str(me.get("user_id") or me.get("id"))
    now = datetime.now(UTC)

    account = await session.scalar(select(IGAccount).where(IGAccount.ig_user_id == ig_user_id))
    if account is None:
        account = IGAccount(ig_user_id=ig_user_id, access_token_enc="")
        session.add(account)
    account.username = me.get("username") or ""
    account.name = me.get("name")
    account.profile_picture_url = me.get("profile_picture_url")
    account.access_token_enc = encrypt_secret(token)
    account.token_expires_at = (
        now + timedelta(seconds=expires_in) if expires_in else now + DEFAULT_TOKEN_LIFETIME
    )
    account.token_refreshed_at = now
    account.is_active = True
    account.last_error = None

    try:
        await ig.InstagramClient(token, ig_user_id).subscribe_webhooks()
        account.webhooks_subscribed = True
    except ig.InstagramAPIError as exc:
        account.webhooks_subscribed = False
        account.last_error = f"Webhook subscription failed: {exc}"
    await session.commit()
    return account


@router.get("/api/config")
async def config(_: UserDep) -> dict[str, Any]:
    settings = get_settings()
    base = settings.public_base_url.rstrip("/")
    return {
        "public_base_url": base,
        "webhook_url": f"{base}/webhooks/instagram",
        "oauth_redirect_uri": settings.oauth_redirect_uri,
        "instagram_app_configured": bool(
            settings.instagram_app_id and settings.instagram_app_secret
        ),
        "graph_api_version": settings.graph_api_version,
    }


@router.get("/api/accounts", response_model=list[AccountOut])
async def list_accounts(_: UserDep, session: SessionDep) -> list[IGAccount]:
    return list(await session.scalars(select(IGAccount).order_by(IGAccount.id)))


@router.post("/api/accounts/token", response_model=AccountOut)
async def connect_with_token(body: TokenIn, _: UserDep, session: SessionDep) -> IGAccount:
    token = body.access_token.strip()
    if not token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Paste an access token")
    return await _save_account(session, token, None)


@router.get("/api/instagram/oauth/start")
async def oauth_start(_: UserDep) -> dict[str, str]:
    settings = get_settings()
    if not (settings.instagram_app_id and settings.instagram_app_secret):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in .env first",
        )
    return {"url": ig.build_authorize_url(create_state_token("instagram-oauth"))}


@router.get("/api/instagram/oauth/callback")
async def oauth_callback(
    session: SessionDep,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error_description: str | None = Query(None),
) -> RedirectResponse:
    if not code:
        return _accounts_redirect(error=error_description or "Login was cancelled")
    if not state or not verify_state_token(state, "instagram-oauth"):
        return _accounts_redirect(error="Login expired, please try again")
    try:
        short = await ig.exchange_code_for_token(code)
        long = await ig.exchange_for_long_lived_token(short["access_token"])
        await _save_account(session, long["access_token"], int(long.get("expires_in") or 0))
    except (ig.InstagramAPIError, KeyError, HTTPException) as exc:
        log.warning("Instagram OAuth failed: %s", exc)
        detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
        return _accounts_redirect(error=str(detail))
    return _accounts_redirect(connected="1")


def _accounts_redirect(**params: str) -> RedirectResponse:
    return RedirectResponse(f"/accounts?{urlencode(params)}", status_code=status.HTTP_302_FOUND)


@router.post("/api/accounts/{account_id}/subscribe", response_model=AccountOut)
async def subscribe(account_id: int, _: UserDep, session: SessionDep) -> IGAccount:
    account = await get_account_or_404(session, account_id)
    try:
        await _client(account).subscribe_webhooks()
        account.webhooks_subscribed = True
        account.last_error = None
    except ig.InstagramAPIError as exc:
        account.webhooks_subscribed = False
        account.last_error = f"Webhook subscription failed: {exc}"
    await session.commit()
    return account


@router.post("/api/accounts/{account_id}/refresh-token", response_model=AccountOut)
async def refresh_token(account_id: int, _: UserDep, session: SessionDep) -> IGAccount:
    account = await get_account_or_404(session, account_id)
    try:
        data = await ig.refresh_long_lived_token(decrypt_secret(account.access_token_enc))
    except ig.InstagramAPIError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Refresh failed (tokens must be at least 24 hours old): {exc}",
        ) from exc
    now = datetime.now(UTC)
    account.access_token_enc = encrypt_secret(data["access_token"])
    account.token_expires_at = now + timedelta(seconds=int(data.get("expires_in") or 5184000))
    account.token_refreshed_at = now
    account.last_error = None
    await session.commit()
    return account


@router.patch("/api/accounts/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: int, body: AccountPatch, _: UserDep, session: SessionDep
) -> IGAccount:
    account = await get_account_or_404(session, account_id)
    account.is_active = body.is_active
    await session.commit()
    return account


@router.delete("/api/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: int, _: UserDep, session: SessionDep) -> None:
    account = await get_account_or_404(session, account_id)
    await session.delete(account)
    await session.commit()


@router.get("/api/accounts/{account_id}/media")
async def list_media(
    account_id: int, _: UserDep, session: SessionDep, after: str | None = None
) -> dict[str, Any]:
    account = await get_account_or_404(session, account_id)
    try:
        data = await _client(account).list_media(after=after)
    except ig.InstagramAPIError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Instagram error: {exc}") from exc
    cursors = (data.get("paging") or {}).get("cursors") or {}
    has_next = bool((data.get("paging") or {}).get("next"))
    keys = (
        "id",
        "caption",
        "media_type",
        "media_product_type",
        "media_url",
        "thumbnail_url",
        "permalink",
        "timestamp",
    )
    items = [{key: item.get(key) for key in keys} for item in data.get("data") or []]
    return {"items": items, "next": cursors.get("after") if has_next else None}

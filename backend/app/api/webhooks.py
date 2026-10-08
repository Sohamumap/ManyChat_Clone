import json
import logging

from fastapi import APIRouter, HTTPException, Query, Request, Response, status

from app.api.deps import SessionDep
from app.app_settings import load_instagram_config
from app.config import get_settings
from app.jobs.queue import enqueue
from app.models import WebhookEvent
from app.security import verify_webhook_signature

log = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/instagram")
async def verify_subscription(
    mode: str = Query("", alias="hub.mode"),
    token: str = Query("", alias="hub.verify_token"),
    challenge: str = Query("", alias="hub.challenge"),
) -> Response:
    if mode == "subscribe" and token and token == get_settings().webhook_verify_token:
        return Response(challenge, media_type="text/plain")
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Verification failed")


@router.post("/instagram")
async def receive(request: Request, session: SessionDep) -> Response:
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    secrets = (await load_instagram_config(session)).webhook_secrets
    if not any(verify_webhook_signature(body, signature, secret) for secret in secrets):
        log.warning("Rejected webhook with invalid signature")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid signature")
    try:
        payload = json.loads(body)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid JSON") from exc

    # Store and hand off to the worker; Meta wants a fast 200
    event = WebhookEvent(payload=payload)
    session.add(event)
    await session.flush()
    await enqueue(session, "webhook", {"webhook_event_id": event.id})
    await session.commit()
    return Response("EVENT_RECEIVED", media_type="text/plain")

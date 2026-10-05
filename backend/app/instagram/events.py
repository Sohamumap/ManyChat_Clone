"""Parse Instagram webhook payloads into typed events.

Comment change (entry[].changes[]):
    {"field": "comments", "value": {"id": "<comment id>", "text": "...",
     "from": {"id": "<IGSID>", "username": "..."},
     "media": {"id": "<media id>", "media_product_type": "REELS"}, "parent_id": "..."}}

Messaging event (entry[].messaging[]):
    {"sender": {"id": "<IGSID>"}, "recipient": {"id": "<IG id>"}, "timestamp": 1700000000000,
     "message": {"mid": "...", "text": "...", "quick_reply": {"payload": "..."}, "is_echo": true}}
    {"sender": ..., "recipient": ..., "postback": {"mid": "...", "title": "...", "payload": "..."}}
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CommentEvent:
    account_ig_id: str
    comment_id: str
    text: str
    from_id: str
    from_username: str | None
    media_id: str | None
    media_product_type: str | None
    parent_id: str | None


@dataclass
class MessageEvent:
    account_ig_id: str
    sender_id: str
    recipient_id: str
    mid: str | None
    text: str | None
    quick_reply_payload: str | None = None
    is_echo: bool = False
    attachments: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class PostbackEvent:
    account_ig_id: str
    sender_id: str
    recipient_id: str
    mid: str | None
    title: str | None
    payload: str


InstagramEvent = CommentEvent | MessageEvent | PostbackEvent


def parse_webhook(payload: dict[str, Any]) -> list[InstagramEvent]:
    events: list[InstagramEvent] = []
    if payload.get("object") != "instagram":
        return events
    for entry in payload.get("entry") or []:
        account_id = str(entry.get("id", ""))
        for change in entry.get("changes") or []:
            if change.get("field") in ("comments", "live_comments"):
                event = _parse_comment(account_id, change.get("value") or {})
                if event:
                    events.append(event)
        for item in entry.get("messaging") or []:
            event = _parse_messaging(account_id, item)
            if event:
                events.append(event)
    return events


def _parse_comment(account_id: str, value: dict[str, Any]) -> CommentEvent | None:
    # Instagram Login sends "id"; the Facebook Login variant sends "comment_id"
    comment_id = value.get("id") or value.get("comment_id")
    sender = value.get("from") or {}
    if not comment_id or not sender.get("id"):
        return None
    media = value.get("media") or {}
    return CommentEvent(
        account_ig_id=account_id,
        comment_id=str(comment_id),
        text=value.get("text") or "",
        from_id=str(sender["id"]),
        from_username=sender.get("username"),
        media_id=str(media["id"]) if media.get("id") else None,
        media_product_type=media.get("media_product_type"),
        parent_id=value.get("parent_id"),
    )


def _parse_messaging(account_id: str, item: dict[str, Any]) -> InstagramEvent | None:
    sender_id = str((item.get("sender") or {}).get("id", ""))
    recipient_id = str((item.get("recipient") or {}).get("id", ""))
    if not sender_id:
        return None
    if postback := item.get("postback"):
        return PostbackEvent(
            account_ig_id=account_id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            mid=postback.get("mid"),
            title=postback.get("title"),
            payload=postback.get("payload") or "",
        )
    if message := item.get("message"):
        if message.get("is_deleted") or message.get("is_unsupported"):
            return None
        return MessageEvent(
            account_ig_id=account_id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            mid=message.get("mid"),
            text=message.get("text"),
            quick_reply_payload=(message.get("quick_reply") or {}).get("payload"),
            is_echo=bool(message.get("is_echo")),
            attachments=message.get("attachments") or [],
        )
    # read receipts, reactions, referrals, etc. are ignored
    return None

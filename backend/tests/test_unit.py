import hashlib
import hmac

import pytest
from pydantic import ValidationError

from app.engine.matcher import matches_keywords
from app.engine.runner import make_payload, parse_payload, validate_input
from app.instagram.events import CommentEvent, MessageEvent, PostbackEvent, parse_webhook
from app.schemas import AutomationIn
from app.security import (
    create_session_token,
    decode_session_token,
    decrypt_secret,
    encrypt_secret,
    verify_webhook_signature,
)
from tests.factories import FOLLOW_GATE_FLOW, comment_trigger


@pytest.mark.parametrize(
    ("text", "keywords", "mode", "expected"),
    [
        ("LINK please", ["link"], "contains", True),
        ("unlinked", ["link"], "contains", False),
        ("Send me the GUIDE!", ["guide"], "contains", True),
        ("  Link! ", ["link"], "exact", True),
        ("link please", ["link"], "exact", False),
        ("anything", [], "any", True),
        ("🔥🔥", ["🔥"], "contains", True),
        ("price?", ["price", "cost"], "contains", True),
        ("", ["link"], "contains", False),
        ("free guide", ["free guide"], "contains", True),
    ],
)
def test_keyword_matching(text, keywords, mode, expected):
    assert matches_keywords(text, keywords, mode) is expected


def test_webhook_signature():
    body = b'{"object":"instagram"}'
    good = "sha256=" + hmac.new(b"secret", body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, good, "secret")
    assert not verify_webhook_signature(body, good, "other")
    assert not verify_webhook_signature(body, None, "secret")
    assert not verify_webhook_signature(body, "sha1=abc", "secret")


def test_token_encryption_and_sessions():
    assert decrypt_secret(encrypt_secret("IGAA-token")) == "IGAA-token"
    assert decode_session_token(create_session_token(42)) == 42
    assert decode_session_token("garbage") is None


def test_payload_roundtrip():
    assert parse_payload(make_payload(7, "s_abc")) == (7, "s_abc")
    assert parse_payload("something-else") is None
    assert parse_payload("flow:x:y") is None
    assert parse_payload(None) is None


@pytest.mark.parametrize(
    ("kind", "value", "expected"),
    [
        ("email", " Jane@Example.com ", "jane@example.com"),
        ("email", "not-an-email", None),
        ("phone", "+1 (555) 123-4567", "+15551234567"),
        ("phone", "call me", None),
        ("phone", "12", None),
        ("text", " hello ", "hello"),
        ("text", "   ", None),
    ],
)
def test_validate_input(kind, value, expected):
    assert validate_input(kind, value) == expected


def test_parse_webhook_comment_and_messages():
    payload = {
        "object": "instagram",
        "entry": [
            {
                "id": "IG1",
                "time": 1,
                "changes": [
                    {
                        "field": "comments",
                        "value": {
                            "id": "C1",
                            "text": "link",
                            "from": {"id": "U1", "username": "jane"},
                            "media": {"id": "M1", "media_product_type": "REELS"},
                        },
                    }
                ],
                "messaging": [
                    {
                        "sender": {"id": "U1"},
                        "recipient": {"id": "IG1"},
                        "message": {"mid": "mid1", "text": "hi"},
                    },
                    {
                        "sender": {"id": "U1"},
                        "recipient": {"id": "IG1"},
                        "postback": {"mid": "mid2", "title": "Go", "payload": "flow:1:s"},
                    },
                    {"sender": {"id": "U1"}, "recipient": {"id": "IG1"}, "read": {"mid": "x"}},
                ],
            }
        ],
    }
    events = parse_webhook(payload)
    assert [type(e) for e in events] == [CommentEvent, MessageEvent, PostbackEvent]
    comment = events[0]
    assert (comment.comment_id, comment.from_username, comment.media_id) == ("C1", "jane", "M1")
    assert parse_webhook({"object": "page", "entry": []}) == []


def _automation(**overrides):
    data = {
        "account_id": 1,
        "name": "x",
        "trigger": comment_trigger(),
        "flow": FOLLOW_GATE_FLOW,
    }
    data.update(overrides)
    return AutomationIn.model_validate(data)


def test_flow_validation_accepts_follow_gate():
    assert _automation().flow.get("gate").type == "follow_check"


def test_flow_validation_rejects_missing_targets_and_bad_start():
    broken = {
        "start_step_id": "a",
        "steps": [{"id": "a", "type": "message", "text": "hi", "next_step_id": "nope"}],
    }
    with pytest.raises(ValidationError, match="missing step"):
        _automation(flow=broken)

    delay_first = {
        "start_step_id": "a",
        "steps": [{"id": "a", "type": "delay", "seconds": 5}],
    }
    with pytest.raises(ValidationError, match="first step must be a message"):
        _automation(flow=delay_first)

    dupes = {
        "start_step_id": "a",
        "steps": [
            {"id": "a", "type": "message", "text": "x"},
            {"id": "a", "type": "message", "text": "y"},
        ],
    }
    with pytest.raises(ValidationError, match="unique"):
        _automation(flow=dupes)


def test_flow_validation_counts_utf8_bytes():
    emoji_text = "🔥" * 200  # 800 bytes: fine alone, too long with buttons (640)
    with_buttons = {
        "start_step_id": "a",
        "steps": [
            {
                "id": "a",
                "type": "message",
                "text": emoji_text,
                "buttons": [{"title": "Go", "type": "url", "url": "https://x.dev"}],
            }
        ],
    }
    with pytest.raises(ValidationError, match="too long"):
        _automation(flow=with_buttons)
    with_buttons["steps"][0]["buttons"] = []
    _automation(flow=with_buttons)


def test_keyword_required_unless_any():
    with pytest.raises(ValidationError, match="keyword"):
        _automation(trigger=comment_trigger(keywords=[]))
    _automation(trigger=comment_trigger(keywords=[], match="any"))

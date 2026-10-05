from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.engine import handlers
from app.engine.runner import make_payload
from app.instagram.events import CommentEvent, MessageEvent, PostbackEvent
from app.models import CommentEvent as CommentRow
from app.models import Contact, FlowRun, Job, Message
from tests.conftest import ACCOUNT_IG_ID, api_error
from tests.factories import comment_trigger, make_automation

USER = "990001"


def comment(text="LINK please", comment_id="c1", user=USER, media_id="m1", parent_id=None):
    return CommentEvent(
        account_ig_id=ACCOUNT_IG_ID,
        comment_id=comment_id,
        text=text,
        from_id=user,
        from_username="jane",
        media_id=media_id,
        media_product_type="REELS",
        parent_id=parent_id,
    )


def tap(automation_id, step_id, mid="pb1", user=USER):
    return PostbackEvent(
        account_ig_id=ACCOUNT_IG_ID,
        sender_id=user,
        recipient_id=ACCOUNT_IG_ID,
        mid=mid,
        title="tap",
        payload=make_payload(automation_id, step_id),
    )


def dm(text, mid="d1", user=USER, quick_reply=None):
    return MessageEvent(
        account_ig_id=ACCOUNT_IG_ID,
        sender_id=user,
        recipient_id=ACCOUNT_IG_ID,
        mid=mid,
        text=text,
        quick_reply_payload=quick_reply,
    )


async def run_for(session, automation_id) -> FlowRun:
    return await session.scalar(
        select(FlowRun).where(FlowRun.automation_id == automation_id).order_by(FlowRun.id.desc())
    )


async def test_comment_sends_private_reply_with_button(ctx, session, account, fake_ig):
    automation = await make_automation(session, account)

    await handlers.handle_event(ctx, comment())
    await session.commit()

    assert len(fake_ig.sent) == 1
    recipient, message = fake_ig.sent[0]
    assert recipient == {"comment_id": "c1"}
    payload = message["attachment"]["payload"]
    assert payload["template_type"] == "button"
    # name unknown until they DM us, so {first_name} falls back to the username
    assert payload["text"] == "Hey jane! Tap below for the link"
    assert payload["buttons"][0]["payload"] == make_payload(automation.id, "gate")

    row = await session.scalar(select(CommentRow))
    assert (row.status, row.dm_sent, row.automation_id) == ("matched", True, automation.id)
    run = await run_for(session, automation.id)
    assert run.status == "waiting_button"
    job = await session.scalar(select(Job).where(Job.type == "public_reply"))
    assert job.payload["text"] == "Check your DMs!"
    await session.refresh(automation)
    assert automation.triggered_count == 1


async def test_follow_gate_flow(ctx, session, account, fake_ig):
    automation = await make_automation(session, account)
    await handlers.handle_event(ctx, comment())
    await session.commit()

    # Not following yet -> asked to follow
    fake_ig.profiles[USER] = {"username": "jane", "is_user_follow_business": False}
    await handlers.handle_event(ctx, tap(automation.id, "gate", mid="pb1"))
    await session.commit()
    assert fake_ig.texts()[-1] == "Please follow first, then tap below"
    assert fake_ig.sent[-1][0] == {"id": USER}  # window is open now, normal send
    contact = await session.scalar(select(Contact))
    assert contact.is_follower is False

    # Follows now -> gets the link, flow completes
    fake_ig.profiles[USER] = {"username": "jane", "is_user_follow_business": True}
    await handlers.handle_event(ctx, tap(automation.id, "gate", mid="pb2"))
    await session.commit()
    assert fake_ig.texts()[-1] == "Here you go!"
    run = await run_for(session, automation.id)
    assert run.status == "completed"

    # Same postback delivered twice by Meta -> ignored
    sent_before = len(fake_ig.sent)
    await handlers.handle_event(ctx, tap(automation.id, "gate", mid="pb2"))
    await session.commit()
    assert len(fake_ig.sent) == sent_before


async def test_follow_check_without_consent_counts_as_not_following(ctx, session, account, fake_ig):
    automation = await make_automation(session, account)
    await handlers.handle_event(ctx, comment())
    fake_ig.profile_error = api_error(230, message="User consent is required")
    await handlers.handle_event(ctx, tap(automation.id, "gate"))
    await session.commit()
    assert fake_ig.texts()[-1] == "Please follow first, then tap below"


async def test_private_reply_without_button_waits_for_reply(ctx, session, account, fake_ig):
    flow = {
        "start_step_id": "a",
        "steps": [
            {"id": "a", "type": "message", "text": "Thanks for commenting!", "next_step_id": "b"},
            {"id": "b", "type": "message", "text": "Here is part two"},
        ],
    }
    automation = await make_automation(session, account, flow=flow)
    await handlers.handle_event(ctx, comment())
    await session.commit()
    assert fake_ig.texts() == ["Thanks for commenting!"]
    run = await run_for(session, automation.id)
    assert (run.status, run.current_step_id) == ("waiting_reply", "b")

    await handlers.handle_event(ctx, dm("ok!"))
    await session.commit()
    assert fake_ig.texts() == ["Thanks for commenting!", "Here is part two"]
    await session.refresh(run)
    assert run.status == "completed"


async def test_once_per_user_and_dedupe(ctx, session, account, fake_ig):
    await make_automation(session, account)
    await handlers.handle_event(ctx, comment(comment_id="c1"))
    await handlers.handle_event(ctx, comment(comment_id="c1"))  # duplicate delivery
    await handlers.handle_event(ctx, comment(comment_id="c2"))  # same person again
    await session.commit()

    assert len(fake_ig.sent) == 1
    rows = list(await session.scalars(select(CommentRow).order_by(CommentRow.id)))
    assert [r.status for r in rows] == ["matched", "skipped_repeat"]


async def test_ignores_own_comments_and_filters(ctx, session, account, fake_ig):
    await make_automation(
        session, account, trigger=comment_trigger(media_ids=["m1"], top_level_only=True)
    )
    await handlers.handle_event(ctx, comment(user=ACCOUNT_IG_ID, comment_id="own"))
    await handlers.handle_event(ctx, comment(media_id="m2", comment_id="other_post"))
    await handlers.handle_event(ctx, comment(parent_id="c0", comment_id="a_reply"))
    await handlers.handle_event(ctx, comment(text="nice video", comment_id="no_kw"))
    await session.commit()

    assert fake_ig.sent == []
    statuses = list(await session.scalars(select(CommentRow.status).order_by(CommentRow.id)))
    assert statuses == ["no_match", "no_match", "no_match"]  # own comment isn't even stored


async def test_no_public_reply_to_replies(ctx, session, account, fake_ig):
    await make_automation(session, account)
    await handlers.handle_event(ctx, comment(parent_id="c0"))
    await session.commit()
    assert len(fake_ig.sent) == 1
    assert await session.scalar(select(Job).where(Job.type == "public_reply")) is None


async def test_public_reply_job(ctx, session, account, fake_ig):
    await make_automation(session, account)
    await handlers.handle_event(ctx, comment())
    await session.commit()
    row = await session.scalar(select(CommentRow))
    await handlers.post_public_reply(ctx, row.id, "Check your DMs!")
    await session.commit()
    assert fake_ig.public_replies == [("c1", "Check your DMs!")]
    await session.refresh(row)
    assert row.public_reply_id == "reply_c1"


EMAIL_FLOW = {
    "start_step_id": "open",
    "steps": [
        {
            "id": "open",
            "type": "message",
            "text": "Want the guide?",
            "buttons": [{"title": "Yes please", "type": "step", "step_id": "ask"}],
        },
        {
            "id": "ask",
            "type": "collect_input",
            "text": "What's your email?",
            "input_type": "email",
            "retry_text": "That doesn't look like an email",
            "max_attempts": 2,
            "next_step_id": "tag",
        },
        {"id": "tag", "type": "add_tag", "tags": ["lead"], "next_step_id": "thanks"},
        {"id": "thanks", "type": "message", "text": "Thanks {first_name}! Sent to {email}"},
    ],
}


async def test_collect_email(ctx, session, account, fake_ig):
    automation = await make_automation(session, account, flow=EMAIL_FLOW)
    await handlers.handle_event(ctx, comment())
    await handlers.handle_event(ctx, tap(automation.id, "ask"))
    await session.commit()
    assert fake_ig.sent[-1][1]["quick_replies"] == [{"content_type": "user_email"}]

    await handlers.handle_event(ctx, dm("hmm", mid="d1"))
    await session.commit()
    assert fake_ig.texts()[-1] == "That doesn't look like an email"

    await handlers.handle_event(ctx, dm("Jane@Example.com", mid="d2"))
    await session.commit()
    contact = await session.scalar(select(Contact))
    assert contact.email == "jane@example.com"
    assert contact.tags == ["lead"]
    assert fake_ig.texts()[-1] == "Thanks Test! Sent to jane@example.com"
    assert (await run_for(session, automation.id)).status == "completed"


async def test_too_many_invalid_answers_falls_through_to_keywords(ctx, session, account, fake_ig):
    automation = await make_automation(session, account, flow=EMAIL_FLOW)
    await make_automation(
        session,
        account,
        name="price",
        trigger={"type": "dm_keyword", "keywords": ["price"], "match": "contains"},
        flow={
            "start_step_id": "p",
            "steps": [{"id": "p", "type": "message", "text": "It costs $10"}],
        },
    )
    await handlers.handle_event(ctx, comment())
    await handlers.handle_event(ctx, tap(automation.id, "ask"))
    await handlers.handle_event(ctx, dm("nope", mid="d1"))
    await handlers.handle_event(ctx, dm("what's the price", mid="d2"))
    await session.commit()

    assert fake_ig.texts()[-1] == "It costs $10"
    email_run = await run_for(session, automation.id)
    assert email_run.status == "cancelled"


async def test_dm_keyword_and_quick_reply_payload(ctx, session, account, fake_ig):
    flow = {
        "start_step_id": "a",
        "steps": [
            {
                "id": "a",
                "type": "message",
                "text": "Pick one",
                "buttons": [{"title": "Plans", "type": "step", "step_id": "b"}],
            },
            {"id": "b", "type": "message", "text": "Plans start at $5"},
        ],
    }
    automation = await make_automation(
        session,
        account,
        trigger={"type": "dm_keyword", "keywords": ["menu"], "match": "exact"},
        flow=flow,
    )
    await handlers.handle_event(ctx, dm("Menu", mid="d1"))
    await session.commit()
    assert fake_ig.sent[0][0] == {"id": USER}
    assert fake_ig.texts() == ["Pick one"]

    quick_reply = make_payload(automation.id, "b")
    await handlers.handle_event(ctx, dm("Plans", mid="d2", quick_reply=quick_reply))
    await session.commit()
    assert fake_ig.texts() == ["Pick one", "Plans start at $5"]
    logged = list(await session.scalars(select(Message.direction).order_by(Message.id)))
    assert logged == ["in", "out", "in", "out"]


DELAY_FLOW = {
    "start_step_id": "a",
    "steps": [
        {"id": "a", "type": "message", "text": "Hi!", "next_step_id": "wait"},
        {"id": "wait", "type": "delay", "seconds": 60, "next_step_id": "b"},
        {"id": "b", "type": "message", "text": "A minute later"},
    ],
}


async def test_delay_schedules_resume(ctx, session, account, fake_ig):
    automation = await make_automation(
        session,
        account,
        trigger={"type": "dm_keyword", "keywords": ["hi"], "match": "contains"},
        flow=DELAY_FLOW,
    )
    await handlers.handle_event(ctx, dm("hi"))
    await session.commit()
    run = await run_for(session, automation.id)
    assert (run.status, run.current_step_id) == ("waiting_delay", "b")
    job = await session.scalar(select(Job).where(Job.type == "resume_run"))
    assert job.run_at > datetime.now(UTC) + timedelta(seconds=50)

    # A stale token (e.g. from an older delay) does nothing
    await handlers.resume_run(ctx, run, "b", "stale")
    assert fake_ig.texts() == ["Hi!"]

    await handlers.resume_run(ctx, run, job.payload["step_id"], job.payload["token"])
    await session.commit()
    assert fake_ig.texts() == ["Hi!", "A minute later"]
    assert run.status == "completed"


async def test_delay_after_window_closed_fails(ctx, session, account, fake_ig):
    automation = await make_automation(
        session,
        account,
        trigger={"type": "dm_keyword", "keywords": ["hi"], "match": "contains"},
        flow=DELAY_FLOW,
    )
    await handlers.handle_event(ctx, dm("hi"))
    await session.commit()
    contact = await session.scalar(select(Contact))
    contact.last_inbound_at = datetime.now(UTC) - timedelta(hours=25)
    run = await run_for(session, automation.id)
    job = await session.scalar(select(Job).where(Job.type == "resume_run"))
    await handlers.resume_run(ctx, run, job.payload["step_id"], job.payload["token"])
    assert run.status == "failed"
    assert "24-hour" in run.error


async def test_rate_limit_retries_then_permanent_error_fails(ctx, session, account, fake_ig):
    automation = await make_automation(session, account)
    fake_ig.send_errors.append(api_error(4, status=400, message="Rate limit"))
    await handlers.handle_event(ctx, comment())
    await session.commit()

    run = await run_for(session, automation.id)
    assert run.status == "waiting_delay"
    job = await session.scalar(select(Job).where(Job.type == "resume_run"))
    assert job.payload["step_id"] == "open"

    # Retry goes out as the private reply (it was never used)
    await handlers.resume_run(ctx, run, job.payload["step_id"], job.payload["token"])
    await session.commit()
    assert fake_ig.sent[0][0] == {"comment_id": "c1"}
    assert run.status == "waiting_button"

    fake_ig.send_errors.append(api_error(100, message="Invalid parameter"))
    await handlers.handle_event(ctx, tap(automation.id, "link"))
    await session.commit()
    run = await run_for(session, automation.id)
    assert run.status == "failed"
    errors = list(
        await session.scalars(
            select(Message.error).where(Message.error.is_not(None)).order_by(Message.id)
        )
    )
    assert errors == ["[4/None] Rate limit", "[100/None] Invalid parameter"]


async def test_inactive_automation_and_foreign_payload_ignored(ctx, session, account, fake_ig):
    automation = await make_automation(session, account)
    automation.is_active = False
    await session.commit()
    await handlers.handle_event(ctx, comment())
    await handlers.handle_event(ctx, tap(automation.id, "gate"))
    await handlers.handle_event(ctx, tap(9999, "gate", mid="pb9"))
    await session.commit()
    assert fake_ig.sent == []


async def test_failed_dm_does_not_block_next_comment(ctx, session, account, fake_ig):
    await make_automation(
        session, account, trigger=comment_trigger(public_replies=["@{username} sent!"])
    )
    fake_ig.send_errors.append(api_error(10, 2534022, message="Outside of allowed window"))
    await handlers.handle_event(ctx, comment(comment_id="c1"))
    await handlers.handle_event(ctx, comment(comment_id="c2"))
    await session.commit()

    rows = list(await session.scalars(select(CommentRow).order_by(CommentRow.id)))
    assert [r.status for r in rows] == ["matched", "matched"]
    assert rows[0].error and not rows[0].dm_sent
    assert rows[1].dm_sent
    job = await session.scalar(select(Job).where(Job.type == "public_reply"))
    assert job.payload["text"] == "@jane sent!"

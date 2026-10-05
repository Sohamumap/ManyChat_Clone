from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import Date, cast, func, select

from app.api.deps import SessionDep, UserDep
from app.api.runs import run_rows, runs_query
from app.models import Automation, CommentEvent, Contact, FlowRun, Job, Message, WebhookEvent
from app.schemas import CommentEventOut

router = APIRouter(tags=["activity"])


@router.get("/api/activity/comments")
async def comment_activity(
    _: UserDep,
    session: SessionDep,
    account_id: int | None = None,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    where = []
    if account_id is not None:
        where.append(CommentEvent.account_id == account_id)
    if status:
        where.append(CommentEvent.status == status)
    total = await session.scalar(select(func.count()).select_from(CommentEvent).where(*where))
    rows = await session.execute(
        select(CommentEvent, Automation.name)
        .outerjoin(Automation, Automation.id == CommentEvent.automation_id)
        .where(*where)
        .order_by(CommentEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        {**CommentEventOut.model_validate(event).model_dump(), "automation_name": name}
        for event, name in rows.all()
    ]
    return {"items": items, "total": total or 0}


@router.get("/api/activity/runs")
async def run_activity(
    _: UserDep,
    session: SessionDep,
    account_id: int | None = None,
    status: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    where = []
    if account_id is not None:
        where.append(Automation.account_id == account_id)
    if status:
        where.append(FlowRun.status == status)
    total = await session.scalar(select(func.count()).select_from(runs_query(*where).subquery()))
    return {
        "items": await run_rows(session, *where, limit=limit, offset=offset),
        "total": total or 0,
    }


@router.get("/api/activity/webhooks")
async def webhook_log(
    _: UserDep, session: SessionDep, limit: int = Query(50, ge=1, le=200)
) -> list[dict[str, Any]]:
    rows = await session.scalars(
        select(WebhookEvent).order_by(WebhookEvent.received_at.desc()).limit(limit)
    )
    return [
        {
            "id": e.id,
            "received_at": e.received_at,
            "processed_at": e.processed_at,
            "error": e.error,
            "payload": e.payload,
        }
        for e in rows
    ]


@router.get("/api/activity/failed-jobs")
async def failed_jobs(
    _: UserDep, session: SessionDep, limit: int = Query(50, ge=1, le=200)
) -> list[dict[str, Any]]:
    rows = await session.scalars(
        select(Job).where(Job.status == "failed").order_by(Job.updated_at.desc()).limit(limit)
    )
    return [
        {
            "id": j.id,
            "type": j.type,
            "attempts": j.attempts,
            "last_error": j.last_error,
            "updated_at": j.updated_at,
        }
        for j in rows
    ]


@router.get("/api/stats")
async def stats(_: UserDep, session: SessionDep, account_id: int | None = None) -> dict[str, Any]:
    now = datetime.now(UTC)
    day_ago = now - timedelta(hours=24)

    def scoped(query, column):
        return query.where(column == account_id) if account_id is not None else query

    async def count(model, *where, account_column=None) -> int:
        query = select(func.count()).select_from(model).where(*where)
        if account_column is not None:
            query = scoped(query, account_column)
        return int(await session.scalar(query) or 0)

    comments_24h = await count(
        CommentEvent, CommentEvent.created_at >= day_ago, account_column=CommentEvent.account_id
    )
    matched_24h = await count(
        CommentEvent,
        CommentEvent.created_at >= day_ago,
        CommentEvent.status == "matched",
        account_column=CommentEvent.account_id,
    )
    dms_24h = await count(
        Message,
        Message.direction == "out",
        Message.error.is_(None),
        Message.created_at >= day_ago,
        account_column=Message.account_id,
    )
    messages_in_24h = await count(
        Message,
        Message.direction == "in",
        Message.created_at >= day_ago,
        account_column=Message.account_id,
    )
    failed_runs_query = (
        select(func.count())
        .select_from(FlowRun)
        .join(Automation, Automation.id == FlowRun.automation_id)
        .where(FlowRun.status == "failed", FlowRun.updated_at >= day_ago)
    )
    runs_failed_24h = int(
        await session.scalar(scoped(failed_runs_query, Automation.account_id)) or 0
    )

    # 14-day daily series
    start = (now - timedelta(days=13)).date()

    async def daily(model, created_col, *where, account_column) -> dict[date, int]:
        day = cast(created_col, Date)
        query = select(day, func.count()).select_from(model).where(created_col >= start, *where)
        query = scoped(query, account_column).group_by(day)
        return {d: n for d, n in (await session.execute(query)).all()}

    comments_by_day = await daily(
        CommentEvent, CommentEvent.created_at, account_column=CommentEvent.account_id
    )
    dms_by_day = await daily(
        Message,
        Message.created_at,
        Message.direction == "out",
        Message.error.is_(None),
        account_column=Message.account_id,
    )
    contacts_by_day = await daily(Contact, Contact.created_at, account_column=Contact.account_id)
    series = []
    for i in range(14):
        d = start + timedelta(days=i)
        series.append(
            {
                "date": d.isoformat(),
                "comments": comments_by_day.get(d, 0),
                "dms_sent": dms_by_day.get(d, 0),
                "new_contacts": contacts_by_day.get(d, 0),
            }
        )

    return {
        "contacts": await count(Contact, account_column=Contact.account_id),
        "automations_active": await count(
            Automation, Automation.is_active.is_(True), account_column=Automation.account_id
        ),
        "comments_24h": comments_24h,
        "comments_matched_24h": matched_24h,
        "dms_sent_24h": dms_24h,
        "messages_in_24h": messages_in_24h,
        "runs_failed_24h": runs_failed_24h,
        "emails_collected": await count(
            Contact, Contact.email.is_not(None), account_column=Contact.account_id
        ),
        "daily": series,
    }

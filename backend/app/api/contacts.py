import csv
import io
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select

from app.api.deps import SessionDep, UserDep
from app.api.runs import run_rows
from app.models import Contact, FlowRun, Message
from app.schemas import ContactOut, MessageOut

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def _filtered(account_id: int | None, q: str | None, tag: str | None):
    query = select(Contact)
    if account_id is not None:
        query = query.where(Contact.account_id == account_id)
    if q:
        like = f"%{q.strip().lstrip('@')}%"
        query = query.where(
            or_(
                Contact.username.ilike(like),
                Contact.name.ilike(like),
                Contact.email.ilike(like),
                Contact.phone.ilike(like),
            )
        )
    if tag:
        query = query.where(Contact.tags.contains([tag]))
    return query


@router.get("")
async def list_contacts(
    _: UserDep,
    session: SessionDep,
    account_id: int | None = None,
    q: str | None = None,
    tag: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    query = _filtered(account_id, q, tag)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(Contact.last_interaction_at.desc().nulls_last(), Contact.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return {"items": [ContactOut.model_validate(c) for c in rows], "total": total or 0}


@router.get("/export.csv")
async def export_csv(
    _: UserDep, session: SessionDep, account_id: int | None = None
) -> StreamingResponse:
    rows = await session.scalars(_filtered(account_id, None, None).order_by(Contact.id))
    contacts = list(rows)
    custom_keys = sorted({k for c in contacts for k in (c.custom_fields or {})})
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["username", "name", "email", "phone", "is_follower", "tags", "first_seen", "last_active"]
        + custom_keys
    )
    for c in contacts:
        writer.writerow(
            [
                c.username or "",
                c.name or "",
                c.email or "",
                c.phone or "",
                "" if c.is_follower is None else ("yes" if c.is_follower else "no"),
                ", ".join(c.tags or []),
                c.created_at.isoformat() if c.created_at else "",
                c.last_interaction_at.isoformat() if c.last_interaction_at else "",
            ]
            + [str((c.custom_fields or {}).get(k, "")) for k in custom_keys]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="contacts.csv"'},
    )


async def _get(session: SessionDep, contact_id: int) -> Contact:
    contact = await session.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    return contact


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(contact_id: int, _: UserDep, session: SessionDep) -> Contact:
    return await _get(session, contact_id)


@router.get("/{contact_id}/messages", response_model=list[MessageOut])
async def contact_messages(contact_id: int, _: UserDep, session: SessionDep) -> list[Message]:
    await _get(session, contact_id)
    rows = await session.scalars(
        select(Message)
        .where(Message.contact_id == contact_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(200)
    )
    return list(reversed(list(rows)))


@router.get("/{contact_id}/runs")
async def contact_runs(contact_id: int, _: UserDep, session: SessionDep) -> list[dict[str, Any]]:
    await _get(session, contact_id)
    return await run_rows(session, FlowRun.contact_id == contact_id, limit=100)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: int, _: UserDep, session: SessionDep) -> None:
    await session.delete(await _get(session, contact_id))
    await session.commit()

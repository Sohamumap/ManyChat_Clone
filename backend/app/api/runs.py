from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Automation, Contact, FlowRun
from app.schemas import FlowRunOut


def runs_query(*where: Any):
    return (
        select(FlowRun, Automation.name, Contact.username)
        .join(Automation, Automation.id == FlowRun.automation_id)
        .join(Contact, Contact.id == FlowRun.contact_id)
        .where(*where)
    )


async def run_rows(
    session: AsyncSession, *where: Any, limit: int = 50, offset: int = 0
) -> list[dict[str, Any]]:
    rows = await session.execute(
        runs_query(*where).order_by(FlowRun.updated_at.desc()).limit(limit).offset(offset)
    )
    return [
        {
            **FlowRunOut.model_validate(run).model_dump(),
            "automation_name": automation_name,
            "contact_username": username,
        }
        for run, automation_name, username in rows.all()
    ]

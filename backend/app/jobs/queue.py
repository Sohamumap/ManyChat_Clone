"""A small durable job queue on top of Postgres.

Jobs are rows in the `jobs` table. The worker claims due jobs with
`SELECT ... FOR UPDATE SKIP LOCKED`, so several workers could run safely,
and nothing is lost if the process restarts (no Redis needed).
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Job

STALE_LOCK = timedelta(minutes=5)


async def enqueue(
    session: AsyncSession,
    job_type: str,
    payload: dict[str, Any] | None = None,
    *,
    delay_seconds: float = 0,
    max_attempts: int | None = None,
) -> Job:
    job = Job(
        type=job_type,
        payload=payload or {},
        run_at=datetime.now(UTC) + timedelta(seconds=delay_seconds),
        max_attempts=max_attempts or get_settings().job_max_attempts,
    )
    session.add(job)
    await session.flush()
    return job


async def claim_due_jobs(session: AsyncSession, limit: int) -> list[Job]:
    """Lock and mark up to `limit` due jobs as running. Caller must commit."""
    now = datetime.now(UTC)
    rows = await session.scalars(
        select(Job)
        .where(Job.status == "pending", Job.run_at <= now)
        .order_by(Job.run_at, Job.id)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    jobs = list(rows)
    for job in jobs:
        job.status = "running"
        job.locked_at = now
        job.attempts += 1
    return jobs


def backoff_seconds(attempt: int) -> int:
    return min(10 * 2 ** (attempt - 1), 3600)


async def mark_done(session: AsyncSession, job_id: int) -> None:
    await session.execute(
        update(Job).where(Job.id == job_id).values(status="done", locked_at=None, last_error=None)
    )


async def mark_failed(session: AsyncSession, job: Job, error: str) -> None:
    """Retry with exponential backoff, or give up after max_attempts."""
    if job.attempts >= job.max_attempts:
        values: dict[str, Any] = {"status": "failed"}
    else:
        values = {
            "status": "pending",
            "run_at": datetime.now(UTC) + timedelta(seconds=backoff_seconds(job.attempts)),
        }
    await session.execute(
        update(Job)
        .where(Job.id == job.id)
        .values(locked_at=None, last_error=error[:4000], **values)
    )


async def release_stale_locks(session: AsyncSession) -> int:
    """Jobs left 'running' by a crashed worker go back to the queue."""
    result = await session.execute(
        update(Job)
        .where(Job.status == "running", Job.locked_at < datetime.now(UTC) - STALE_LOCK)
        .values(status="pending", locked_at=None)
    )
    return result.rowcount or 0


async def prune_finished(session: AsyncSession, older_than: timedelta) -> int:
    result = await session.execute(
        delete(Job).where(
            Job.status.in_(["done", "failed"]), Job.updated_at < datetime.now(UTC) - older_than
        )
    )
    return result.rowcount or 0

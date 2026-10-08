from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))


class IGAccount(TimestampMixin, Base):
    """An Instagram professional account connected to the app."""

    __tablename__ = "ig_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    # The IG professional account id. Webhook entries carry it as entry[].id.
    ig_user_id: Mapped[str] = mapped_column(String(64), unique=True)
    username: Mapped[str] = mapped_column(String(255), default="")
    name: Mapped[str | None] = mapped_column(String(255))
    profile_picture_url: Mapped[str | None] = mapped_column(Text)
    access_token_enc: Mapped[str] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    token_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    webhooks_subscribed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_error: Mapped[str | None] = mapped_column(Text)


class Contact(TimestampMixin, Base):
    """A person who interacted with a connected account (identified by their IGSID)."""

    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("account_id", "igsid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("ig_accounts.id", ondelete="CASCADE"))
    igsid: Mapped[str] = mapped_column(String(64))
    username: Mapped[str | None] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(255))
    profile_pic: Mapped[str | None] = mapped_column(Text)
    is_follower: Mapped[bool | None] = mapped_column(Boolean)
    follower_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(64))
    custom_fields: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    # Last time the contact messaged us / tapped a button: opens the 24h messaging window.
    last_inbound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_interaction_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Automation(TimestampMixin, Base):
    __tablename__ = "automations"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("ig_accounts.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # "comment" | "dm_keyword"
    trigger_type: Mapped[str] = mapped_column(String(32))
    trigger: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    # {"start_step_id": "...", "steps": [...]} -- see app.schemas.Flow
    flow: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    triggered_count: Mapped[int] = mapped_column(Integer, default=0)


class FlowRun(TimestampMixin, Base):
    """One contact's progress through one automation's flow."""

    __tablename__ = "flow_runs"
    __table_args__ = (Index("ix_flow_runs_contact_status", "contact_id", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    automation_id: Mapped[int] = mapped_column(ForeignKey("automations.id", ondelete="CASCADE"))
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"))
    # running | waiting_button | waiting_reply | waiting_input | waiting_delay
    # | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(32), default="running")
    current_step_id: Mapped[str | None] = mapped_column(String(64))
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    steps_executed: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)


class CommentEvent(Base):
    __tablename__ = "comment_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("ig_accounts.id", ondelete="CASCADE"))
    comment_id: Mapped[str] = mapped_column(String(64), unique=True)
    media_id: Mapped[str | None] = mapped_column(String(64))
    parent_id: Mapped[str | None] = mapped_column(String(64))
    text: Mapped[str] = mapped_column(Text, default="")
    from_igsid: Mapped[str | None] = mapped_column(String(64))
    from_username: Mapped[str | None] = mapped_column(String(255))
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id", ondelete="SET NULL"))
    automation_id: Mapped[int | None] = mapped_column(
        ForeignKey("automations.id", ondelete="SET NULL")
    )
    # no_match | matched | skipped_repeat | ignored | error
    status: Mapped[str] = mapped_column(String(32), default="no_match")
    public_reply_id: Mapped[str | None] = mapped_column(String(64))
    dm_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Message(Base):
    """Conversation log (inbound and outbound)."""

    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_contact_created", "contact_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("ig_accounts.id", ondelete="CASCADE"))
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"))
    direction: Mapped[str] = mapped_column(String(8))  # in | out
    mid: Mapped[str | None] = mapped_column(String(255), unique=True)
    # text | postback | quick_reply | template | image | attachment | private_reply | echo
    kind: Mapped[str] = mapped_column(String(32), default="text")
    text: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    automation_id: Mapped[int | None] = mapped_column(
        ForeignKey("automations.id", ondelete="SET NULL")
    )
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WebhookEvent(Base):
    """Raw webhook deliveries, kept for debugging (pruned after a retention period)."""

    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Job(TimestampMixin, Base):
    """Durable background job, claimed by the worker with FOR UPDATE SKIP LOCKED."""

    __tablename__ = "jobs"
    __table_args__ = (Index("ix_jobs_status_run_at", "status", "run_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    type: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(
        String(16), default="pending"
    )  # pending|running|done|failed
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    last_error: Mapped[str | None] = mapped_column(Text)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AppSetting(Base):
    """Settings edited from the dashboard; they take precedence over .env. Secrets are encrypted."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

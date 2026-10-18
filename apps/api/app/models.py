"""SQLAlchemy 2.0 models. Same vocabulary as the web app: Venture, Bench,
Counterpart, Pairing, proving run, Milestone, traction ledger, release."""
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from decimal import Decimal
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    roles: Mapped[list] = mapped_column(JSON, default=list)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    platform_terms_version: Mapped[str | None] = mapped_column(String(40))
    headline: Mapped[str | None] = mapped_column(String(300))
    location: Mapped[str | None] = mapped_column(String(120))


class AccountCredential(Base):
    __tablename__ = "account_credentials"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(256))


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Venture(Base):
    __tablename__ = "ventures"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    one_liner: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30))
    stage: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="draft")
    moderation_hold: Mapped[bool] = mapped_column(Boolean, default=False)
    builder_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    location: Mapped[str | None] = mapped_column(String(120))
    product_url: Mapped[str] = mapped_column(String(500), default="")
    product_url_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    screenshots: Mapped[list] = mapped_column(JSON, default=list)
    logo_url: Mapped[str | None] = mapped_column(String(2000))
    traction_summary: Mapped[str] = mapped_column(String(300), default="")
    equity_min_pct: Mapped[float] = mapped_column(Float)
    equity_max_pct: Mapped[float] = mapped_column(Float)
    hours_per_week: Mapped[int] = mapped_column(Integer)
    builder_has_done: Mapped[list] = mapped_column(JSON, default=list)
    counterpart_would_own: Mapped[list] = mapped_column(JSON, default=list)
    metrics: Mapped[list] = mapped_column(JSON, default=list)
    pricing: Mapped[list] = mapped_column(JSON, default=list)
    unit_economics: Mapped[dict] = mapped_column(JSON, default=dict)
    profitability_target: Mapped[dict] = mapped_column(JSON, default=dict)
    interns_welcome: Mapped[bool] = mapped_column(Boolean, default=False)
    vesting_terms: Mapped[str] = mapped_column(Text, default="")
    terms_template_id: Mapped[str] = mapped_column(String(40), default="terms_v0")
    commercial_terms: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    milestones: Mapped[list["Milestone"]] = relationship(back_populates="venture", order_by="Milestone.sequence")


class Milestone(Base):
    __tablename__ = "milestones"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    venture_id: Mapped[str] = mapped_column(ForeignKey("ventures.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    metric_key: Mapped[str] = mapped_column(String(60))
    target_value: Mapped[float] = mapped_column(Float)
    tranche_pct: Mapped[float] = mapped_column(Float)
    window_days: Mapped[int] = mapped_column(Integer)
    is_proving_run: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="locked")
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    missed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cleared_by_ledger_entry_id: Mapped[str | None] = mapped_column(String(40))

    venture: Mapped[Venture] = relationship(back_populates="milestones")


class Pairing(Base):
    __tablename__ = "pairings"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    venture_id: Mapped[str] = mapped_column(ForeignKey("ventures.id"), index=True)
    builder_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    counterpart_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    state: Mapped[str] = mapped_column(String(20), default="proving_run")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    proving_run_days: Mapped[int] = mapped_column(Integer, default=45)
    proving_run_deliverables: Mapped[list] = mapped_column(JSON, default=list)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_by: Mapped[str | None] = mapped_column(String(40))
    end_reason: Mapped[str | None] = mapped_column(Text)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"))
    protocol: Mapped[str] = mapped_column(String(30), default="legacy")
    offered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    agreement: Mapped[dict] = mapped_column(JSON, default=dict)
    milestone_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    continuation_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (UniqueConstraint("pairing_id", "week_starting", name="uq_ledger_pairing_week"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str] = mapped_column(ForeignKey("pairings.id"), index=True)
    week_starting: Mapped[date] = mapped_column(Date)
    values: Mapped[dict] = mapped_column(JSON, default=dict)
    note: Mapped[str] = mapped_column(Text, default="")
    evidence_links: Mapped[list] = mapped_column(JSON, default=list)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    comments: Mapped[list["LedgerComment"]] = relationship(back_populates="entry", order_by="LedgerComment.created_at")


class LedgerComment(Base):
    __tablename__ = "ledger_comments"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("ledger_entries.id"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    entry: Mapped[LedgerEntry] = relationship(back_populates="comments")


class VestingEntry(Base):
    """Earned equity. Never deleted, never reduced."""
    __tablename__ = "vesting_entries"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str] = mapped_column(ForeignKey("pairings.id"), index=True)
    milestone_id: Mapped[str] = mapped_column(ForeignKey("milestones.id"))
    tranche_pct: Mapped[float] = mapped_column(Float)
    vested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ledger_entry_id: Mapped[str] = mapped_column(String(40))


class VoidedTranche(Base):
    __tablename__ = "voided_tranches"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str] = mapped_column(ForeignKey("pairings.id"), index=True)
    milestone_id: Mapped[str] = mapped_column(ForeignKey("milestones.id"))
    tranche_pct: Mapped[float] = mapped_column(Float)
    voided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(String(20))


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("venture_id", "applicant_id", name="uq_application_once"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    venture_id: Mapped[str] = mapped_column(ForeignKey("ventures.id"), index=True)
    applicant_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    evidence: Mapped[str] = mapped_column(Text)
    proof_links: Mapped[list] = mapped_column(JSON, default=list)
    numbers_moved: Mapped[list] = mapped_column(JSON, default=list)
    hours_per_week: Mapped[int] = mapped_column(Integer)
    compensation: Mapped[str] = mapped_column(String(30))
    track: Mapped[str] = mapped_column(String(20), default="counterpart")
    requested_equity_pct: Mapped[float] = mapped_column(Float)
    template_id: Mapped[str] = mapped_column(String(30))
    commitments: Mapped[list] = mapped_column(JSON, default=list)
    acknowledges_resource_clause: Mapped[bool] = mapped_column(Boolean, default=False)
    why_this_venture: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="submitted")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Opening(Base):
    """A paid role. `venture_id` is null when Counterpart itself is hiring."""
    __tablename__ = "openings"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    venture_id: Mapped[str | None] = mapped_column(ForeignKey("ventures.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    team: Mapped[str] = mapped_column(String(80))
    type: Mapped[str] = mapped_column(String(20))
    arrangement: Mapped[str] = mapped_column(String(20))
    location: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text)
    responsibilities: Mapped[list] = mapped_column(JSON, default=list)
    looking_for: Mapped[list] = mapped_column(JSON, default=list)
    salary_min_php_monthly: Mapped[float | None] = mapped_column(Float)
    salary_max_php_monthly: Mapped[float | None] = mapped_column(Float)
    equity_pct: Mapped[float | None] = mapped_column(Float)
    funded_by: Mapped[str] = mapped_column(String(30))
    compensation_details: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open")
    posted_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (UniqueConstraint("opening_id", "applicant_id", name="uq_job_application_once"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    opening_id: Mapped[str] = mapped_column(ForeignKey("openings.id"), index=True)
    applicant_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    evidence: Mapped[str] = mapped_column(Text)
    proof_links: Mapped[list] = mapped_column(JSON, default=list)
    available_from: Mapped[date] = mapped_column(Date)
    expected_salary_php_monthly: Mapped[float | None] = mapped_column(Float)
    offer_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    why_this_role: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="submitted")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TermsTemplate(Base):
    __tablename__ = "terms_templates"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    review_note: Mapped[str] = mapped_column(Text)
    sections: Mapped[list] = mapped_column(JSON, default=list)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    href: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OutboxEmail(Base):
    __tablename__ = "outbox_emails"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    to: Mapped[str] = mapped_column(String(200))
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # sent_at is the legacy enqueue timestamp; only delivered_at records SMTP acceptance.
    dispatch_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0, server_default="0")
    last_error: Mapped[str | None] = mapped_column(String(200))


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (UniqueConstraint("pairing_id", "author_id", "client_id", name="uq_chat_client_message"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str] = mapped_column(ForeignKey("pairings.id"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    client_id: Mapped[str] = mapped_column(String(80))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class RealtimeEvent(Base):
    __tablename__ = "realtime_events"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    channel: Mapped[str] = mapped_column(String(180))
    name: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispatch_after: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0, server_default="0")


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    object_key: Mapped[str] = mapped_column(String(250), unique=True)
    content_type: Mapped[str] = mapped_column(String(80))
    size: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class VerificationSession(Base):
    __tablename__ = "verification_sessions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(40))
    url: Mapped[str] = mapped_column(Text)
    workflow_id: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    provider_updated_at: Mapped[int] = mapped_column(default=0, server_default="0")


class WebhookReceipt(Base):
    __tablename__ = "webhook_receipts"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    provider: Mapped[str] = mapped_column(String(20))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AccountToken(Base):
    __tablename__ = "account_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LedgerRevision(Base):
    __tablename__ = "ledger_revisions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    entry_id: Mapped[str] = mapped_column(ForeignKey("ledger_entries.id"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    snapshot: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ReviewCase(Base):
    __tablename__ = "review_cases"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str | None] = mapped_column(ForeignKey("pairings.id"), index=True)
    venture_id: Mapped[str | None] = mapped_column(ForeignKey("ventures.id"), index=True)
    category: Mapped[str] = mapped_column(String(20), default="dispute", index=True)
    subject: Mapped[str] = mapped_column(String(160), default="Engagement review")
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    events: Mapped[list] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=0)
    opened_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CommercialDeal(Base):
    __tablename__ = "commercial_deals"
    __table_args__ = (UniqueConstraint("pairing_id", "reference", name="uq_deal_reference"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str] = mapped_column(ForeignKey("pairings.id"), index=True)
    reference: Mapped[str] = mapped_column(String(120))
    evidence: Mapped[str] = mapped_column(Text)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CompensationClaim(Base):
    __tablename__ = "compensation_claims"
    __table_args__ = (UniqueConstraint("pairing_id", "reference", name="uq_claim_reference"),)
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str] = mapped_column(ForeignKey("pairings.id"), index=True)
    deal_id: Mapped[str | None] = mapped_column(ForeignKey("commercial_deals.id"))
    kind: Mapped[str] = mapped_column(String(20))
    reference: Mapped[str] = mapped_column(String(120))
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    eligible_revenue_php: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0)
    amount_php: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    evidence: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="submitted")
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    events: Mapped[list] = mapped_column(JSON, default=list)


class EquityGrant(Base):
    __tablename__ = "equity_grants"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    pairing_id: Mapped[str] = mapped_column(ForeignKey("pairings.id"), index=True)
    venture_id: Mapped[str] = mapped_column(ForeignKey("ventures.id"), index=True)
    terms: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="offered")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

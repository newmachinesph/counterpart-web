from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.domain.contracts import CommercialTerms


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(Out):
    id: str
    name: str
    email: str
    roles: list[str]
    email_verified_at: datetime | None = None
    platform_terms_version: str | None = None
    headline: str | None = None
    location: str | None = None


class MilestoneOut(Out):
    id: str
    venture_id: str
    sequence: int
    title: str
    metric_key: str
    target_value: float
    tranche_pct: float
    window_days: int
    is_proving_run: bool
    status: str
    opened_at: datetime | None
    cleared_at: datetime | None
    missed_at: datetime | None
    cleared_by_ledger_entry_id: str | None


class VentureOut(Out):
    id: str
    slug: str
    name: str
    one_liner: str
    description: str
    category: str
    stage: str
    status: str
    builder_id: str
    location: str | None
    product_url: str
    product_url_verified_at: datetime | None
    screenshots: list[str]
    logo_url: str | None = None
    traction_summary: str
    equity_min_pct: float
    equity_max_pct: float
    hours_per_week: int
    builder_has_done: list[str]
    counterpart_would_own: list[str]
    metrics: list[dict]
    pricing: list[dict]
    unit_economics: dict
    profitability_target: dict
    interns_welcome: bool
    vesting_terms: str
    terms_template_id: str
    commercial_terms: dict = {}
    created_at: datetime
    milestones: list[MilestoneOut] = []


class BenchCardOut(BaseModel):
    venture: VentureOut
    applicant_count: int
    total_on_offer_pct: float


class MilestoneIn(BaseModel):
    title: str
    metric_key: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    metric_label: str
    unit: str = Field(pattern=r"^(php|count)$")
    aggregation: str = Field(pattern=r"^(sum|latest)$")
    target_value: float = Field(gt=0)
    tranche_pct: float = Field(ge=0, le=40)
    window_days: int = Field(gt=0)


class VentureIn(BaseModel):
    name: str = Field(min_length=2)
    one_liner: str = Field(min_length=10, max_length=140)
    description: str = Field(min_length=50)
    category: str
    stage: str
    location: str | None = None
    product_url: str
    screenshots: list[str] = []
    logo_url: str | None = Field(default=None, max_length=2000, pattern=r"^https?://[^\s]+$")
    traction_summary: str = ""
    equity_min_pct: float = Field(default=0, ge=0, le=40)
    equity_max_pct: float = Field(default=0, ge=0, le=40)
    commercial_terms: CommercialTerms
    hours_per_week: int = Field(ge=1, le=80)
    builder_has_done: list[str] = []
    counterpart_would_own: list[str] = []
    vesting_terms: str = ""
    pricing: list[dict] = []
    unit_economics: dict = {}
    profitability_target: dict = {}
    interns_welcome: bool = False
    milestones: list[MilestoneIn]

    @model_validator(mode="after")
    def commercial_listing(self):
        if self.equity_min_pct or self.equity_max_pct or any(m.tranche_pct for m in self.milestones):
            raise ValueError("Commercial listings do not award equity. Agree a separate documented cofounder grant after the trial.")
        if self.interns_welcome:
            raise ValueError("Post paid internships under Jobs with appropriate employment terms")
        if not self.milestones:
            raise ValueError("Add at least one performance milestone")
        if self.milestones[0].window_days != self.commercial_terms.trial_days:
            raise ValueError("The first milestone window must match the agreed trial duration")
        return self


class PairingOut(Out):
    id: str
    venture_id: str
    builder_id: str
    counterpart_id: str
    state: str
    protocol: str = "legacy"
    offered_at: datetime | None = None
    accepted_at: datetime | None = None
    application_id: str | None = None
    agreement: dict = {}
    milestone_snapshot: list[dict] = []
    continuation_requested_at: datetime | None = None
    started_at: datetime
    proving_run_days: int
    proving_run_deliverables: list[str]
    converted_at: datetime | None
    ended_at: datetime | None
    ended_by: str | None
    end_reason: str | None


class CommentOut(Out):
    id: str
    author_id: str
    body: str
    created_at: datetime


class LedgerEntryOut(Out):
    id: str
    pairing_id: str
    week_starting: date
    values: dict[str, float]
    note: str
    evidence_links: list[str]
    submitted_at: datetime
    updated_at: datetime
    comments: list[CommentOut] = []


class LedgerEntryIn(BaseModel):
    week_starting: date
    values: dict[str, float]
    note: str = ""
    evidence_links: list[str] = []


class CommentIn(BaseModel):
    body: str


class NumbersMovedIn(BaseModel):
    metric: str
    before: str
    after: str
    timeframe: str


class ApplicationIn(BaseModel):
    evidence: str
    proof_links: list[str]
    numbers_moved: list[NumbersMovedIn]
    hours_per_week: int = Field(ge=1, le=80)
    compensation: str = Field(default="cash", pattern=r"^cash$")
    track: str = Field(default="counterpart", pattern=r"^counterpart$")
    requested_equity_pct: float = Field(default=0, ge=0, le=0)
    template_id: str = Field(default="operator_v1", pattern=r"^operator_v1$")
    commitments: list[str] = []
    acknowledges_resource_clause: bool = False
    why_this_venture: str


class ApplicationOut(Out):
    id: str
    venture_id: str
    applicant_id: str
    evidence: str
    proof_links: list[str]
    numbers_moved: list[dict]
    hours_per_week: int
    compensation: str
    track: str
    requested_equity_pct: float
    template_id: str
    commitments: list[str]
    acknowledges_resource_clause: bool
    why_this_venture: str
    status: str
    submitted_at: datetime
    decided_at: datetime | None


class ReviewIn(BaseModel):
    action: str = Field(pattern=r"^(shortlist|decline|invite)$")


class EndIn(BaseModel):
    reason: str = ""


class ReviewRequestIn(BaseModel):
    message: str


class VestingOut(Out):
    id: str
    milestone_id: str
    tranche_pct: float
    vested_at: datetime
    ledger_entry_id: str


class VoidedOut(Out):
    id: str
    milestone_id: str
    tranche_pct: float
    voided_at: datetime
    reason: str


class NotificationOut(Out):
    id: str
    body: str
    href: str | None
    created_at: datetime
    read_at: datetime | None


class OpeningOut(Out):
    id: str
    venture_id: str | None
    title: str
    team: str
    type: str
    arrangement: str
    location: str
    summary: str
    responsibilities: list[str]
    looking_for: list[str]
    salary_min_php_monthly: float | None
    salary_max_php_monthly: float | None
    equity_pct: float | None
    funded_by: str
    compensation_details: str = ""
    status: str
    posted_by_id: str
    created_at: datetime
    closes_at: datetime | None


class OpeningCardOut(BaseModel):
    opening: OpeningOut
    venture: VentureOut | None
    applicant_count: int
    ledger_revenue_php: float


class OpeningIn(BaseModel):
    venture_id: str | None = None
    title: str = Field(min_length=2)
    team: str = Field(min_length=1)
    type: str = Field(pattern=r"^(full_time|part_time|contract|internship)$")
    arrangement: str = Field(pattern=r"^(onsite|hybrid|remote)$")
    location: str = Field(min_length=1)
    summary: str = Field(min_length=20)
    responsibilities: list[str] = []
    looking_for: list[str] = []
    salary_min_php_monthly: float | None = None
    salary_max_php_monthly: float | None = None
    equity_pct: float | None = Field(default=None, ge=0, le=5)
    funded_by: str = Field(pattern=r"^(ledger_revenue|outside_funding|commission_only|equity_only)$")
    compensation_details: str = Field(min_length=80, max_length=5000)

    @model_validator(mode="after")
    def paid_job(self):
        if not self.salary_min_php_monthly or self.salary_min_php_monthly <= 0 or self.funded_by not in ("ledger_revenue", "outside_funding"):
            raise ValueError("Jobs require a cash salary. List commission-based commercial partnerships on the Bench.")
        if self.equity_pct:
            raise ValueError("Document any employee equity separately; a job posting does not grant shares")
        return self


class OpeningStatusIn(BaseModel):
    status: str = Field(pattern=r"^(open|closed|filled)$")


class JobApplicationIn(BaseModel):
    evidence: str
    proof_links: list[str]
    available_from: date
    expected_salary_php_monthly: float | None = None
    why_this_role: str


class JobApplicationOut(Out):
    offer_snapshot: dict = Field(default_factory=dict)
    id: str
    opening_id: str
    applicant_id: str
    evidence: str
    proof_links: list[str]
    available_from: date
    expected_salary_php_monthly: float | None
    why_this_role: str
    status: str
    submitted_at: datetime
    decided_at: datetime | None


class JobReviewIn(BaseModel):
    action: str = Field(pattern=r"^(shortlist|decline|hire)$")
    agreement_hash: str = ""


class DashboardOut(BaseModel):
    pairing: PairingOut
    venture: VentureOut
    builder: UserOut
    counterpart: UserOut
    day_count: int
    proving_run_days_left: int | None
    milestones: list[dict[str, Any]]
    open_milestone: MilestoneOut | None
    cards: dict[str, Any]
    weeks: list[dict[str, Any]]
    this_week: date
    vesting: list[VestingOut]
    voided: list[VoidedOut]

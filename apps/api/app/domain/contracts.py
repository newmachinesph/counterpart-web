"""Versioned commercial terms. Money uses decimal arithmetic; performance is not equity."""
from calendar import monthrange
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pydantic import BaseModel, ConfigDict, Field, model_validator

OPERATOR_VERSION = "operator_v1"
PLATFORM_VERSION = "platform_2026_09"


class CommercialTerms(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    trial_days: int = Field(default=45, ge=1, le=90)
    term_days: int = Field(default=180, ge=1, le=730)
    monthly_fee_php: Decimal = Field(default=Decimal(0), ge=0, le=10000000, decimal_places=2)
    commission_rate_pct: Decimal = Field(default=Decimal(0), ge=0, le=100, decimal_places=2)
    eligible_revenue: str = Field(min_length=20, max_length=3000)
    attribution: str = Field(min_length=20, max_length=3000)
    payment_days: int = Field(default=15, ge=1, le=60)
    tail_days: int = Field(default=90, ge=0, le=365)
    expense_policy: str = Field(min_length=10, max_length=3000)
    contracting_party: str = Field(min_length=3, max_length=300)
    dispute_process: str = Field(min_length=20, max_length=3000)

    @model_validator(mode="after")
    def consistent(self):
        if self.monthly_fee_php == 0 and self.commission_rate_pct == 0:
            raise ValueError("Agree a cash fee or sales commission before publishing")
        if self.term_days < self.trial_days:
            raise ValueError("The engagement term cannot end before the trial")
        return self


OPERATOR_TEMPLATE = {
    "id": OPERATOR_VERSION,
    "title": "Commercial partner agreement",
    "review_note": "Version operator_v1. Complete and review the terms before accepting. This agreement records cash compensation; it does not grant shares or determine employment status. Obtain advice suited to the actual working relationship.",
    "sections": [
        {"heading": "Parties and work", "body": "[CONTRACTING_PARTY], represented by [BUILDER_NAME], engages [COUNTERPART_NAME] for [VENTURE_NAME]. Responsibilities: [OPERATOR_SCOPE]. Builder commitments: [BUILDER_COMMITMENTS]. Neither person may bind the other without written authority."},
        {"heading": "Acceptance and duration", "body": "Work starts only when the invited counterpart accepts this exact offer. The paid trial lasts [TRIAL_DAYS] days. Continuing beyond the trial requires both parties' recorded agreement. The total engagement lasts at most [TERM_DAYS] days from acceptance unless a new agreement is accepted. A KPI does not automatically extend the engagement or create cofounder status."},
        {"heading": "Fees and commission", "body": "Monthly fee: PHP [MONTHLY_FEE_PHP], prorated by active calendar days in each month. Commission: [COMMISSION_RATE_PCT]% of eligible collected revenue. Eligible revenue, including exclusions and refund treatment: [ELIGIBLE_REVENUE]. Attribution: [ATTRIBUTION_RULE]. Figures in the weekly ledger alone do not establish a payment or equity award."},
        {"heading": "Evidence and payment", "body": "Register eligible deals during the engagement. Submit collection evidence and unique receipt references. Fees accrue under the agreement and may be claimed after month-end or departure. Payment is due within [PAYMENT_DAYS] days after the relevant collection or fee period ends. Review must be prompt; a dispute does not erase earned compensation. The platform records external payments; it does not hold or transfer funds."},
        {"heading": "Expenses and access", "body": "Expenses and approvals: [EXPENSE_POLICY]. The builder supplies agreed access and product support. Deliberately withholding access, attribution records, or collection information does not cancel accrued compensation."},
        {"heading": "Ending and pipeline", "body": "Either party may end the engagement by recorded notice, subject to applicable law. New work and new deal registration stop at departure. Eligible collections on pre-exit registered deals remain commissionable for [TAIL_DAYS] days after departure. No automatic lifetime commission or company-wide profit share is created. Accrued fees, commissions, documented expenses, and other surviving obligations remain payable. Complete handover and revoke unnecessary access."},
        {"heading": "Confidentiality and work product", "body": "Use confidential information only for this work and protect personal data and credentials. Pre-existing IP remains with its owner. Record any required license or assignment in a separate written document; this template does not silently transfer pre-existing IP."},
        {"heading": "Evidence, corrections and disputes", "body": "Keep accurate records. Corrections and dispute outcomes are recorded without deleting earlier evidence. The agreed dispute process is: [DISPUTE_PROCESS]. Either party can open a review case. Platform administration records outcomes but does not replace the agreed forum or statutory rights."},
        {"heading": "Separate cofounder decision", "body": "This commercial agreement grants no equity. Becoming a cofounder requires a separate agreed instrument identifying the company, share class, units, capitalization basis, vesting, approvals, and departure terms. Leaving does not automatically cancel equity already validly earned under such an instrument."},
        {"heading": "Record and amendments", "body": "The offer, responsibilities, compensation, milestone definitions, and template version are saved together. Acceptance records both parties' agreement to that offer. Changes require a new accepted document; editing a public preview cannot change an existing engagement. Mandatory legal rights continue to apply."},
    ],
}


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def monthly_fee(terms, start, end, year, month):
    """Calendar-day proration, with an exclusive engagement-end boundary."""
    first = datetime(year, month, 1, tzinfo=start.tzinfo)
    days = monthrange(year, month)[1]
    next_month = first + timedelta(days=days)
    low, high = max(start, first), min(end, next_month)
    if high <= low:
        return Decimal("0.00")
    # A partial service day is paid as a day; the same date is never counted twice.
    count = (high.date() - low.date()).days + (1 if high.time() != datetime.min.time() else 0)
    return money(Decimal(str(terms["monthly_fee_php"])) * Decimal(count) / Decimal(days))


def vested_units(terms, at):
    start = datetime.fromisoformat(terms["vesting_start"])
    if at < start:
        return 0
    months = (at.year - start.year) * 12 + at.month - start.month
    anniversary_day = min(start.day, monthrange(at.year, at.month)[1])
    if (at.day, at.time()) < (anniversary_day, start.time()):
        months -= 1
    if months < terms["cliff_months"]:
        return 0
    return terms["grant_units"] * min(months, terms["vesting_months"]) // terms["vesting_months"]

"""Openings: paid roles on a venture, and roles at Counterpart itself.

Two rules keep this from becoming a generic job board. A paid role must name
where the money comes from, and when it says `ledger_revenue` the figure is
computed from the venture's traction ledger. Employee equity is capped well
below a Counterpart seat, which is earned on the Bench.
"""

EMPLOYEE_EQUITY_CAP_PCT = 5.0
MIN_JOB_EVIDENCE_CHARS = 120

OPENING_TYPES = ("full_time", "part_time", "contract", "internship")
WORK_ARRANGEMENTS = ("onsite", "hybrid", "remote")
FUNDING_SOURCES = ("ledger_revenue", "outside_funding", "commission_only", "equity_only")
OPENING_STATUSES = ("open", "closed", "filled")


def is_paid(salary_min: float | None) -> bool:
    return salary_min is not None and salary_min > 0


def validate_opening(
    *,
    venture_id: str | None,
    title: str,
    summary: str,
    responsibilities: list[str],
    looking_for: list[str],
    salary_min: float | None,
    salary_max: float | None,
    equity_pct: float | None,
    funded_by: str,
    ledger_revenue_php: float,
) -> str | None:
    if not title.strip():
        return "Give the role a title"
    if not summary.strip():
        return "Say what the role does"
    if not responsibilities:
        return "List at least one responsibility"
    if not looking_for:
        return "Say what you are looking for, in evidence"

    paid = is_paid(salary_min)
    if salary_min is not None and salary_min < 0:
        return "Pay cannot be negative"
    if salary_max is not None and salary_min is not None and salary_max < salary_min:
        return "The top of the range cannot be below the bottom"
    if paid and salary_max is None:
        return "Give the top of the pay range"

    if paid and funded_by in ("commission_only", "equity_only"):
        return "A role with a salary cannot be commission only or equity only"
    if not paid and funded_by in ("ledger_revenue", "outside_funding"):
        return "Name a pay range, or mark the role commission only or equity only"

    if funded_by == "ledger_revenue":
        if venture_id is None:
            return "Counterpart roles are not paid from a venture ledger"
        if ledger_revenue_php <= 0:
            return "This venture's ledger has no revenue yet. Fund the role another way, or log the revenue first."
        if salary_max is not None and salary_max > ledger_revenue_php:
            return f"The ledger shows PHP {ledger_revenue_php:,.0f} a month. A role paying more than that needs another funding source."

    if equity_pct is not None:
        if equity_pct <= 0:
            return "Leave equity blank rather than zero"
        if equity_pct > EMPLOYEE_EQUITY_CAP_PCT:
            return f"A job offers at most {EMPLOYEE_EQUITY_CAP_PCT:g}% equity. More than that is a Counterpart seat, listed on the Bench."
    return None


def validate_job_application(*, evidence: str, proof_links: list[str], why_this_role: str, expected_salary: float | None, opening_status: str) -> str | None:
    if opening_status != "open":
        return "This role is no longer open"
    if len(evidence.strip()) < MIN_JOB_EVIDENCE_CHARS:
        return f"Tell them what you have done, in at least {MIN_JOB_EVIDENCE_CHARS} characters"
    if not proof_links:
        return "Add at least one link that shows the work"
    if not why_this_role.strip():
        return "Say why this role"
    if expected_salary is not None and expected_salary < 0:
        return "Expected pay cannot be negative"
    return None
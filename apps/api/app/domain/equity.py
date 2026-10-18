"""Equity structures, the 40% cap, and profitability math."""
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.domain.ledger import Entry, Metric, week_start_of

EQUITY_CAP_PCT = 40.0
RESOURCE_CLAUSE_PCT = 25.0
RESOURCE_CLAUSE = (
    "Requesting 25% or more means you are bringing your own resources to the venture: your time as a "
    "priority, your transport and tools, your network, and enough runway to work unpaid through the "
    "proving run. The equity is for the growth you bring, not the seat."
)


@dataclass(frozen=True)
class Template:
    id: str
    name: str
    track: str
    equity_min_pct: float
    equity_max_pct: float
    hours_min: int
    hours_max: int
    resource_clause: bool


TEMPLATES = [
    Template("intern", "Intern", "intern", 0.5, 2, 10, 15, False),
    Template("closer", "Territory closer", "counterpart", 4, 8, 10, 15, False),
    Template("growth", "Growth partner", "counterpart", 10, 20, 20, 25, False),
    Template("operator", "Operating co-founder", "counterpart", 25, EQUITY_CAP_PCT, 35, 40, True),
]


def template_by_id(template_id: str) -> Template | None:
    return next((t for t in TEMPLATES if t.id == template_id), None)


def validate_equity_request(track: str, requested_pct: float, template_id: str, acknowledged: bool, venture_min: float, venture_max: float, interns_welcome: bool) -> str | None:
    t = template_by_id(template_id)
    if t is None:
        return "Pick an equity structure"
    if t.track != track:
        return f"The {t.name} structure is for the {t.track} track"
    if requested_pct <= 0:
        return "Ask for a real number"
    if requested_pct > EQUITY_CAP_PCT:
        return f"The cap is {EQUITY_CAP_PCT:g}%"
    if track == "intern":
        if not interns_welcome:
            return "This venture is not taking interns right now"
        if not (t.equity_min_pct <= requested_pct <= t.equity_max_pct):
            return f"Intern tranches run from {t.equity_min_pct:g}% to {t.equity_max_pct:g}%"
    else:
        cap = min(venture_max, EQUITY_CAP_PCT)
        if not (venture_min <= requested_pct <= cap):
            return f"This venture offers {venture_min:g}% to {cap:g}%"
        if not (t.equity_min_pct <= requested_pct <= t.equity_max_pct):
            return f"The {t.name} structure allows {t.equity_min_pct:g}% to {t.equity_max_pct:g}%"
    if (requested_pct >= RESOURCE_CLAUSE_PCT or t.resource_clause) and not acknowledged:
        return "Asking for this much means bringing your own resources. Confirm that you have read the clause."
    return None


def contribution_margin(revenue_per_unit: float, variable_cost_per_unit: float) -> float:
    if revenue_per_unit <= 0:
        return 0.0
    return max(0.0, (revenue_per_unit - variable_cost_per_unit) / revenue_per_unit)


def revenue_run_rate(entries: list[Entry], metrics: list[Metric], now: datetime) -> tuple[float, int]:
    """Money the ledger has actually seen in the last four weeks, as a monthly figure."""
    revenue_metric = next((m for m in metrics if m.key == "revenue_php"), None) or next((m for m in metrics if m.unit == "php"), None)
    if revenue_metric is None:
        return 0.0, 0
    this_week = week_start_of(now)
    window_start = this_week - timedelta(weeks=3)
    in_window = [e for e in entries if window_start <= e.week_starting <= this_week]
    return sum(e.values.get(revenue_metric.key, 0) for e in in_window), len(in_window)


def profitability_progress(entries: list[Entry], metrics: list[Metric], revenue_per_unit: float, variable_cost_per_unit: float, target_php: float, now: datetime) -> dict:
    run_rate, weeks_counted = revenue_run_rate(entries, metrics, now)
    margin = contribution_margin(revenue_per_unit, variable_cost_per_unit)
    contribution = round(run_rate * margin)
    return {
        "run_rate_revenue_php": run_rate,
        "margin_pct": round(margin * 100),
        "contribution_php": contribution,
        "target_php": target_php,
        "pct": min(100, round(contribution / target_php * 100)) if target_php > 0 else 0,
        "weeks_counted": weeks_counted,
    }

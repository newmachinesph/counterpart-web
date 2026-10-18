from datetime import datetime, timezone

from app.domain.equity import EQUITY_CAP_PCT, contribution_margin, profitability_progress, validate_equity_request
from tests.conftest import METRICS, entry


def v(track, pct, template, ack=False, vmin=8, vmax=12, interns=True):
    return validate_equity_request(track, pct, template, ack, vmin, vmax, interns)


def test_cap_and_venture_range():
    assert EQUITY_CAP_PCT == 40
    assert v("counterpart", 10, "growth") is None
    assert "cap is 40%" in v("counterpart", 45, "operator", True, 30, 60, False)
    assert v("counterpart", 40, "operator", True, 30, 60, False) is None
    assert "offers 8% to 12%" in v("counterpart", 5, "closer")
    assert "offers 8% to 12%" in v("counterpart", 15, "growth")


def test_resource_clause():
    assert "structure allows" in v("counterpart", 20, "closer", False, 10, 40, False)
    assert "own resources" in v("counterpart", 30, "operator", False, 10, 40, False)
    assert v("counterpart", 30, "operator", True, 10, 40, False) is None
    assert v("counterpart", 20, "growth", False, 10, 40, False) is None


def test_interns():
    assert v("intern", 1.5, "intern") is None
    assert "0.5% to 2%" in v("intern", 5, "intern")
    assert "not taking interns" in v("intern", 1, "intern", interns=False)
    assert "counterpart track" in v("intern", 1, "closer")


def test_profitability_uses_last_four_weeks():
    entries = [entry("2026-05-25", 1, 9999, 0), entry("2026-06-01", 2, 4000, 0), entry("2026-06-08", 3, 5000, 0), entry("2026-06-15", 3, 6000, 0), entry("2026-06-22", 4, 5000, 0)]
    p = profitability_progress(entries, METRICS, 620, 62, 30000, datetime(2026, 6, 24, tzinfo=timezone.utc))
    assert p["run_rate_revenue_php"] == 20000 and p["weeks_counted"] == 4
    assert p["contribution_php"] == 18000 and p["pct"] == 60
    assert abs(contribution_margin(620, 62) - 0.9) < 1e-9

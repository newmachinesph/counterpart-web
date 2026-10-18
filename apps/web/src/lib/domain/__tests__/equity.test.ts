import { describe, expect, it } from "vitest";
import {
  EQUITY_CAP_PCT,
  RESOURCE_CLAUSE_PCT,
  contributionMargin,
  profitabilityProgress,
  templatesForVenture,
  validateEquityRequest,
} from "../equity";
import { METRICS, d, makeEntry } from "./fixtures";

const venture = { equityMinPct: 8, equityMaxPct: 12, internsWelcome: true };

describe("equity cap and request validation", () => {
  it("accepts a request inside the venture range with a matching template", () => {
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 10, templateId: "growth", acknowledgesResourceClause: false, venture })).toBeNull();
  });

  it("refuses anything above the 40% cap even if the venture range allowed it", () => {
    const generous = { equityMinPct: 30, equityMaxPct: 60, internsWelcome: false };
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 45, templateId: "operator", acknowledgesResourceClause: true, venture: generous })).toMatch(/cap is 40%/);
    expect(EQUITY_CAP_PCT).toBe(40);
  });

  it("clamps the venture maximum to the cap", () => {
    const generous = { equityMinPct: 30, equityMaxPct: 60, internsWelcome: false };
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 40, templateId: "operator", acknowledgesResourceClause: true, venture: generous })).toBeNull();
  });

  it("refuses requests outside the venture range", () => {
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 5, templateId: "closer", acknowledgesResourceClause: false, venture })).toMatch(/offers 8% to 12%/);
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 15, templateId: "growth", acknowledgesResourceClause: false, venture })).toMatch(/offers 8% to 12%/);
  });

  it("requires the resource clause at 25% and above, and for the operator template at any level", () => {
    const wide = { equityMinPct: 10, equityMaxPct: 40, internsWelcome: false };
    expect(RESOURCE_CLAUSE_PCT).toBe(25);
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 30, templateId: "operator", acknowledgesResourceClause: false, venture: wide })).toMatch(/own resources/);
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 30, templateId: "operator", acknowledgesResourceClause: true, venture: wide })).toBeNull();
    expect(validateEquityRequest({ track: "counterpart", requestedEquityPct: 20, templateId: "growth", acknowledgesResourceClause: false, venture: wide })).toBeNull();
  });

  it("keeps interns inside the intern tranche and only where interns are welcome", () => {
    expect(validateEquityRequest({ track: "intern", requestedEquityPct: 1.5, templateId: "intern", acknowledgesResourceClause: false, venture })).toBeNull();
    expect(validateEquityRequest({ track: "intern", requestedEquityPct: 5, templateId: "intern", acknowledgesResourceClause: false, venture })).toMatch(/0.5% to 2%/);
    expect(validateEquityRequest({ track: "intern", requestedEquityPct: 1, templateId: "intern", acknowledgesResourceClause: false, venture: { ...venture, internsWelcome: false } })).toMatch(/not taking interns/);
  });

  it("refuses a template from the other track", () => {
    expect(validateEquityRequest({ track: "intern", requestedEquityPct: 1, templateId: "closer", acknowledgesResourceClause: false, venture })).toMatch(/counterpart track/);
  });

  it("suggests only templates that overlap the venture range, plus interns when welcome", () => {
    expect(templatesForVenture(venture).map((t) => t.id)).toEqual(["intern", "closer", "growth"]);
    expect(templatesForVenture({ equityMinPct: 25, equityMaxPct: 40, internsWelcome: false }).map((t) => t.id)).toEqual(["operator"]);
  });
});

describe("profitability", () => {
  const unitEconomics = { unitLabel: "merchant", revenuePerUnitPhpMonthly: 620, variableCostPerUnitPhpMonthly: 62, note: "" };
  const target = { monthlyContributionPhp: 30000, withinDays: 270, excludes: ["tech"] };

  it("computes contribution margin from unit economics", () => {
    expect(contributionMargin(unitEconomics)).toBeCloseTo(0.9);
    expect(contributionMargin({ ...unitEconomics, revenuePerUnitPhpMonthly: 0 })).toBe(0);
  });

  it("uses the last four weeks of revenue as the run rate", () => {
    const entries = [
      makeEntry("2026-05-25", { merchants_live: 1, revenue_php: 9999, paying_users: 0 }),
      makeEntry("2026-06-01", { merchants_live: 2, revenue_php: 4000, paying_users: 0 }),
      makeEntry("2026-06-08", { merchants_live: 3, revenue_php: 5000, paying_users: 0 }),
      makeEntry("2026-06-15", { merchants_live: 3, revenue_php: 6000, paying_users: 0 }),
      makeEntry("2026-06-22", { merchants_live: 4, revenue_php: 5000, paying_users: 0 }),
    ];
    const p = profitabilityProgress(entries, { metrics: METRICS, unitEconomics, profitabilityTarget: target }, d("2026-06-24T00:00:00Z"));
    expect(p.runRateRevenuePhp).toBe(20000);
    expect(p.weeksCounted).toBe(4);
    expect(p.contributionPhp).toBe(18000);
    expect(p.pct).toBe(60);
  });

  it("caps progress at 100 and handles no revenue", () => {
    const rich = [makeEntry("2026-06-22", { merchants_live: 1, revenue_php: 100000, paying_users: 0 })];
    expect(profitabilityProgress(rich, { metrics: METRICS, unitEconomics, profitabilityTarget: target }, d("2026-06-24T00:00:00Z")).pct).toBe(100);
    expect(profitabilityProgress([], { metrics: METRICS, unitEconomics, profitabilityTarget: target }, d("2026-06-24T00:00:00Z")).contributionPhp).toBe(0);
  });
});
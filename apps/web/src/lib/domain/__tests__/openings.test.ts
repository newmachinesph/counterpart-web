import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_EQUITY_CAP_PCT,
  MIN_JOB_EVIDENCE_CHARS,
  isPaid,
  payLabel,
  sortOpenings,
  validateJobApplication,
  validateOpening,
  type OpeningDraft,
} from "../openings";
import type { Opening } from "../types";

const draft = (over: Partial<OpeningDraft> = {}): OpeningDraft => ({
  ventureId: "ven_kyp",
  title: "Field sales representative",
  team: "Field sales",
  type: "part_time",
  arrangement: "onsite",
  location: "Quezon City",
  summary: "Sign coffee shops and salons along Maginhawa.",
  responsibilities: ["Walk the route"],
  lookingFor: ["You have sold to small shops before"],
  salaryMinPhpMonthly: 12000,
  salaryMaxPhpMonthly: 18000,
  equityPct: null,
  fundedBy: "ledger_revenue",
  ...over,
});

const funded = (php: number) => ({ ledgerRevenuePhp: php });

describe("posting an opening", () => {
  it("accepts a paid role backed by the ledger", () => {
    expect(validateOpening(draft(), funded(20000))).toBeNull();
  });

  it("demands the basics", () => {
    expect(validateOpening(draft({ title: "  " }), funded(20000))).toMatch(/title/);
    expect(validateOpening(draft({ summary: "" }), funded(20000))).toMatch(/what the role does/);
    expect(validateOpening(draft({ responsibilities: [] }), funded(20000))).toMatch(/responsibility/);
    expect(validateOpening(draft({ lookingFor: [] }), funded(20000))).toMatch(/evidence/);
  });

  it("refuses a range that runs backwards or a missing top", () => {
    expect(validateOpening(draft({ salaryMinPhpMonthly: 20000, salaryMaxPhpMonthly: 10000 }), funded(50000))).toMatch(/cannot be below/);
    expect(validateOpening(draft({ salaryMaxPhpMonthly: null }), funded(50000))).toMatch(/top of the pay range/);
    expect(validateOpening(draft({ salaryMinPhpMonthly: -1 }), funded(50000))).toMatch(/negative/);
  });

  describe("the funding rule", () => {
    it("refuses ledger funding when the ledger has seen nothing", () => {
      expect(validateOpening(draft(), funded(0))).toMatch(/no revenue yet/);
    });

    it("refuses a salary the ledger cannot cover", () => {
      expect(validateOpening(draft(), funded(15000))).toMatch(/₱15,000 a month/);
      expect(validateOpening(draft({ salaryMaxPhpMonthly: 15000 }), funded(15000))).toBeNull();
    });

    it("lets a builder fund a role from their own pocket without a ledger", () => {
      expect(validateOpening(draft({ fundedBy: "outside_funding" }), funded(0))).toBeNull();
    });

    it("keeps salary and no-pay funding apart", () => {
      expect(validateOpening(draft({ fundedBy: "commission_only" }), funded(50000))).toMatch(/cannot be commission only/);
      expect(validateOpening(draft({ fundedBy: "equity_only" }), funded(50000))).toMatch(/cannot be commission only/);
      const unpaid = { salaryMinPhpMonthly: null, salaryMaxPhpMonthly: null };
      expect(validateOpening(draft({ ...unpaid, fundedBy: "outside_funding" }), funded(50000))).toMatch(/Name a pay range/);
      expect(validateOpening(draft({ ...unpaid, fundedBy: "commission_only" }), funded(0))).toBeNull();
    });

    it("never lets a Counterpart role claim a venture ledger", () => {
      expect(validateOpening(draft({ ventureId: null }), funded(90000))).toMatch(/not paid from a venture ledger/);
      expect(validateOpening(draft({ ventureId: null, fundedBy: "outside_funding" }), funded(0))).toBeNull();
    });
  });

  it("keeps employee equity far below a Counterpart seat", () => {
    expect(EMPLOYEE_EQUITY_CAP_PCT).toBe(5);
    expect(validateOpening(draft({ equityPct: 2 }), funded(50000))).toBeNull();
    expect(validateOpening(draft({ equityPct: 8 }), funded(50000))).toMatch(/at most 5%.*Counterpart seat/);
    expect(validateOpening(draft({ equityPct: 0 }), funded(50000))).toMatch(/blank rather than zero/);
  });

  it("knows a paid role from an unpaid one", () => {
    expect(isPaid({ salaryMinPhpMonthly: 1 })).toBe(true);
    expect(isPaid({ salaryMinPhpMonthly: 0 })).toBe(false);
    expect(isPaid({ salaryMinPhpMonthly: null })).toBe(false);
  });
});

describe("applying to an opening", () => {
  const good = {
    evidence: "x".repeat(MIN_JOB_EVIDENCE_CHARS),
    proofLinks: ["https://example.com"],
    availableFrom: "2026-10-01",
    expectedSalaryPhpMonthly: 15000,
    whyThisRole: "I know the route.",
  };

  it("accepts a complete application to an open role", () => {
    expect(validateJobApplication(good, { status: "open" })).toBeNull();
  });

  it("refuses a role that is closed or filled", () => {
    expect(validateJobApplication(good, { status: "closed" })).toMatch(/no longer open/);
    expect(validateJobApplication(good, { status: "filled" })).toMatch(/no longer open/);
  });

  it("still asks for evidence, proof, a reason, and a start date", () => {
    expect(validateJobApplication({ ...good, evidence: "too short" }, { status: "open" })).toMatch(/at least 120/);
    expect(validateJobApplication({ ...good, proofLinks: [] }, { status: "open" })).toMatch(/shows the work/);
    expect(validateJobApplication({ ...good, whyThisRole: " " }, { status: "open" })).toMatch(/why this role/);
    expect(validateJobApplication({ ...good, availableFrom: "soon" }, { status: "open" })).toMatch(/when you can start/);
    expect(validateJobApplication({ ...good, expectedSalaryPhpMonthly: -5 }, { status: "open" })).toMatch(/negative/);
  });
});

describe("presentation", () => {
  it("writes the pay in words a person reads", () => {
    expect(payLabel({ salaryMinPhpMonthly: 12000, salaryMaxPhpMonthly: 18000, equityPct: null, fundedBy: "ledger_revenue" })).toBe("₱12,000 to ₱18,000 a month");
    expect(payLabel({ salaryMinPhpMonthly: 20000, salaryMaxPhpMonthly: 20000, equityPct: 1, fundedBy: "outside_funding" })).toBe("₱20,000 a month plus 1% equity");
    expect(payLabel({ salaryMinPhpMonthly: null, salaryMaxPhpMonthly: null, equityPct: null, fundedBy: "commission_only" })).toBe("Commission only");
    expect(payLabel({ salaryMinPhpMonthly: null, salaryMaxPhpMonthly: null, equityPct: 2, fundedBy: "equity_only" })).toBe("2% equity, no pay");
  });

  it("puts Counterpart's own roles first, then the newest venture roles", () => {
    const o = (id: string, ventureId: string | null, createdAt: string) => ({ id, ventureId, createdAt }) as Opening;
    const sorted = sortOpenings([o("a", "ven_1", "2026-01-01"), o("b", null, "2025-01-01"), o("c", "ven_2", "2026-06-01")]);
    expect(sorted.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});
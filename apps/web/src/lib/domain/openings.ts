import type { FundedBy, JobApplication, Opening, OpeningType, WorkArrangement } from "./types";

/**
 * Openings: paid roles on a venture, and roles at Counterpart itself.
 *
 * Two rules keep this from becoming a generic job board:
 *
 * 1. A paid role must name where the money comes from. When it says
 *    `ledger_revenue`, the figure is computed from the venture's traction
 *    ledger, so nobody can advertise money the ledger has not seen.
 * 2. Employee equity is capped well below a Counterpart seat. A real stake in
 *    the venture is earned on the Bench, not offered as a perk.
 */

export const EMPLOYEE_EQUITY_CAP_PCT = 5;
export const MIN_JOB_EVIDENCE_CHARS = 120;

export const OPENING_TYPE_LABELS: Record<OpeningType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  internship: "Internship",
};

export const ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};

export const FUNDING_LABELS: Record<FundedBy, string> = {
  ledger_revenue: "Paid from revenue on the traction ledger",
  outside_funding: "Paid from the builder's own funds",
  commission_only: "Commission only, no base pay",
  equity_only: "Equity only, no pay",
};

export function isPaid(o: Pick<Opening, "salaryMinPhpMonthly">): boolean {
  return o.salaryMinPhpMonthly !== null && o.salaryMinPhpMonthly > 0;
}

export interface OpeningDraft {
  compensationDetails?: string;
  ventureId: string | null;
  title: string;
  team: string;
  type: OpeningType;
  arrangement: WorkArrangement;
  location: string;
  summary: string;
  responsibilities: string[];
  lookingFor: string[];
  salaryMinPhpMonthly: number | null;
  salaryMaxPhpMonthly: number | null;
  equityPct: number | null;
  fundedBy: FundedBy;
}

export interface FundingContext {
  /** Monthly revenue the venture's ledger has actually recorded. */
  ledgerRevenuePhp: number;
}

/** Returns a human message when the opening is not allowed, or null when it is. */
export function validateOpening(draft: OpeningDraft, ctx: FundingContext): string | null {
  if (!draft.title.trim()) return "Give the role a title";
  if (!draft.summary.trim()) return "Say what the role does";
  if (draft.responsibilities.length === 0) return "List at least one responsibility";
  if (draft.lookingFor.length === 0) return "Say what you are looking for, in evidence";

  const { salaryMinPhpMonthly: min, salaryMaxPhpMonthly: max } = draft;
  const paid = isPaid(draft);

  if (min !== null && min < 0) return "Pay cannot be negative";
  if (max !== null && min !== null && max < min) return "The top of the range cannot be below the bottom";
  if (paid && max === null) return "Give the top of the pay range";

  if (paid && (draft.fundedBy === "commission_only" || draft.fundedBy === "equity_only")) {
    return "A role with a salary cannot be commission only or equity only";
  }
  if (!paid && (draft.fundedBy === "ledger_revenue" || draft.fundedBy === "outside_funding")) {
    return "Name a pay range, or mark the role commission only or equity only";
  }
  if (draft.fundedBy === "ledger_revenue") {
    if (draft.ventureId === null) return "Counterpart roles are not paid from a venture ledger";
    if (ctx.ledgerRevenuePhp <= 0) {
      return "This venture's ledger has no revenue yet. Fund the role another way, or log the revenue first.";
    }
    if (max !== null && max > ctx.ledgerRevenuePhp) {
      return `The ledger shows ₱${ctx.ledgerRevenuePhp.toLocaleString("en-PH")} a month. A role paying more than that needs another funding source.`;
    }
  }

  if (draft.equityPct !== null) {
    if (draft.equityPct <= 0) return "Leave equity blank rather than zero";
    if (draft.equityPct > EMPLOYEE_EQUITY_CAP_PCT) {
      return `A job offers at most ${EMPLOYEE_EQUITY_CAP_PCT}% equity. More than that is a Counterpart seat, listed on the Bench.`;
    }
  }
  return null;
}

export interface JobApplicationDraft {
  evidence: string;
  proofLinks: string[];
  availableFrom: string;
  expectedSalaryPhpMonthly: number | null;
  whyThisRole: string;
}

export function validateJobApplication(draft: JobApplicationDraft, opening: Pick<Opening, "status">): string | null {
  if (opening.status !== "open") return "This role is no longer open";
  if (draft.evidence.trim().length < MIN_JOB_EVIDENCE_CHARS) {
    return `Tell them what you have done, in at least ${MIN_JOB_EVIDENCE_CHARS} characters`;
  }
  if (draft.proofLinks.length === 0) return "Add at least one link that shows the work";
  if (!draft.whyThisRole.trim()) return "Say why this role";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.availableFrom)) return "Say when you can start";
  if (draft.expectedSalaryPhpMonthly !== null && draft.expectedSalaryPhpMonthly < 0) {
    return "Expected pay cannot be negative";
  }
  return null;
}

export function payLabel(o: Pick<Opening, "salaryMinPhpMonthly" | "salaryMaxPhpMonthly" | "equityPct" | "fundedBy">): string {
  const php = (n: number) => `₱${n.toLocaleString("en-PH")}`;
  const equity = o.equityPct ? ` plus ${o.equityPct}% equity` : "";
  if (o.fundedBy === "commission_only") return `Commission only${equity}`;
  if (o.fundedBy === "equity_only") return o.equityPct ? `${o.equityPct}% equity, no pay` : "Equity only";
  if (o.salaryMinPhpMonthly === null) return `Pay not stated${equity}`;
  if (o.salaryMaxPhpMonthly === null || o.salaryMaxPhpMonthly === o.salaryMinPhpMonthly) {
    return `${php(o.salaryMinPhpMonthly)} a month${equity}`;
  }
  return `${php(o.salaryMinPhpMonthly)} to ${php(o.salaryMaxPhpMonthly)} a month${equity}`;
}

export function sortOpenings(openings: readonly Opening[]): Opening[] {
  // Counterpart's own roles first, then newest.
  return [...openings].sort((a, b) => {
    if ((a.ventureId === null) !== (b.ventureId === null)) return a.ventureId === null ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function jobApplicationCount(applications: readonly JobApplication[], openingId: string): number {
  return applications.filter((a) => a.openingId === openingId).length;
}

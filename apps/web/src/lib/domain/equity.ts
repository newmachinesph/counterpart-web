import { addWeeks, weekStartOf } from "./ledger";
import type { LedgerEntry, MetricDefinition, Track, UnitEconomics, Venture } from "./types";

// Equity structures, the platform cap, and profitability math.
//
// A Counterpart can ask for at most 40%. Asking for 25% or more means the
// person is committing their own resources, time, and skills to bring
// growth, not just hours, and they have to say so.

export const EQUITY_CAP_PCT = 40;
export const RESOURCE_CLAUSE_PCT = 25;
export const RESOURCE_CLAUSE =
  "Requesting 25% or more means you are bringing your own resources to the venture: your time as a priority, your transport and tools, your network, and enough runway to work unpaid through the proving run. The equity is for the growth you bring, not the seat.";

export interface EquityTemplate {
  id: string;
  name: string;
  tagline: string;
  track: Track;
  equityMinPct: number;
  equityMaxPct: number;
  hoursMin: number;
  hoursMax: number;
  brings: string[];
  owns: string[];
  milestoneShape: string[];
  resourceClause: boolean;
}

export const EQUITY_TEMPLATES: EquityTemplate[] = [
  {
    id: "intern",
    name: "Intern",
    tagline: "A 12-week slice of one channel, supervised, with a small tranche if it works.",
    track: "intern",
    equityMinPct: 0.5,
    equityMaxPct: 2,
    hoursMin: 10,
    hoursMax: 15,
    brings: ["Time and attention", "A phone and a willingness to knock on doors", "Weekly written notes"],
    owns: ["One channel or one territory slice", "Customer research the builder asks for", "The ledger for that slice"],
    milestoneShape: ["A small traction target for the slice, like 3 customers or 50 sign-ups", "A written playbook the next person can follow"],
    resourceClause: false,
  },
  {
    id: "closer",
    name: "Territory closer",
    tagline: "Own acquisition in one city or one channel. Get paid in tranches for customers that stay.",
    track: "counterpart",
    equityMinPct: 4,
    equityMaxPct: 8,
    hoursMin: 10,
    hoursMax: 15,
    brings: ["Own transport and phone", "A network in one territory", "A weekly rhythm"],
    owns: ["Acquisition in one territory", "First-week onboarding of each customer", "The weekly traction ledger"],
    milestoneShape: ["Proving run: the first 3 to 5 customers", "A customer count target inside 120 days", "A retained-customer target after that"],
    resourceClause: false,
  },
  {
    id: "growth",
    name: "Growth partner",
    tagline: "Own acquisition, activation, and pricing. Most of the commercial side, part time.",
    track: "counterpart",
    equityMinPct: 10,
    equityMaxPct: 20,
    hoursMin: 20,
    hoursMax: 25,
    brings: ["Channel playbooks that have worked before", "A budget for your own tools", "Relationships that shorten the first ten sales"],
    owns: ["Acquisition across channels", "Activation and the plan ladder", "Pricing tests", "The weekly traction ledger"],
    milestoneShape: ["Proving run: the first customers", "A revenue target inside 90 to 120 days", "A retention or paying-user target", "A second territory or channel"],
    resourceClause: false,
  },
  {
    id: "operator",
    name: "Operating co-founder",
    tagline: "The whole commercial side, full time, to the profitability target. The 40% seat.",
    track: "counterpart",
    equityMinPct: 25,
    equityMaxPct: EQUITY_CAP_PCT,
    hoursMin: 35,
    hoursMax: 40,
    brings: ["Full-time attention with your own runway through the proving run", "Your own travel, tools, and working capital for the field", "Your network for the first sales hire"],
    owns: ["Everything commercial: sales, pricing, partnerships, support", "Hiring and managing the first sales hire", "The profitability target", "The weekly traction ledger"],
    milestoneShape: ["Proving run: the first customers", "A revenue target inside 90 days", "The first sales hire, paid from revenue", "The profitability target reached and held for 8 weeks"],
    resourceClause: true,
  },
];

export function templateById(id: string): EquityTemplate | null {
  return EQUITY_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Templates that make sense for a venture: those overlapping its equity range, plus interns if welcome. */
export function templatesForVenture(venture: Pick<Venture, "equityMinPct" | "equityMaxPct" | "internsWelcome">): EquityTemplate[] {
  return EQUITY_TEMPLATES.filter((t) => {
    if (t.track === "intern") return venture.internsWelcome;
    return t.equityMaxPct >= venture.equityMinPct && t.equityMinPct <= venture.equityMaxPct;
  });
}

export interface EquityRequest {
  track: Track;
  requestedEquityPct: number;
  templateId: string;
  acknowledgesResourceClause: boolean;
  venture: Pick<Venture, "equityMinPct" | "equityMaxPct" | "internsWelcome">;
}

/** Returns a human message when the request is not allowed, or null when it is. */
export function validateEquityRequest(req: EquityRequest): string | null {
  const { requestedEquityPct: pct, venture } = req;
  const template = templateById(req.templateId);
  if (!template) return "Pick an equity structure";
  if (template.track !== req.track) return `The ${template.name} structure is for the ${template.track} track`;
  if (!Number.isFinite(pct) || pct <= 0) return "Ask for a real number";
  if (pct > EQUITY_CAP_PCT) return `The cap is ${EQUITY_CAP_PCT}%`;
  if (req.track === "intern") {
    if (!venture.internsWelcome) return "This venture is not taking interns right now";
    if (pct < template.equityMinPct || pct > template.equityMaxPct) return `Intern tranches run from ${template.equityMinPct}% to ${template.equityMaxPct}%`;
  } else {
    const max = Math.min(venture.equityMaxPct, EQUITY_CAP_PCT);
    if (pct < venture.equityMinPct || pct > max) return `This venture offers ${venture.equityMinPct}% to ${max}%`;
    if (pct < template.equityMinPct || pct > template.equityMaxPct) return `The ${template.name} structure allows ${template.equityMinPct}% to ${template.equityMaxPct}%`;
  }
  if ((pct >= RESOURCE_CLAUSE_PCT || template.resourceClause) && !req.acknowledgesResourceClause) {
    return "Asking for this much means bringing your own resources. Confirm that you have read the clause.";
  }
  return null;
}

// Profitability

export function contributionMargin(u: UnitEconomics): number {
  if (u.revenuePerUnitPhpMonthly <= 0) return 0;
  return Math.max(0, (u.revenuePerUnitPhpMonthly - u.variableCostPerUnitPhpMonthly) / u.revenuePerUnitPhpMonthly);
}

export interface ProfitabilityProgress {
  runRateRevenuePhp: number;
  marginPct: number;
  contributionPhp: number;
  targetPhp: number;
  pct: number;
  weeksCounted: number;
}

/**
 * Monthly run rate = revenue logged in the last four weeks with entries.
 * Contribution = run rate times the unit contribution margin.
 */

/** Money the ledger has actually seen in the last four weeks, as a monthly figure. */
export function revenueRunRate(
  entries: readonly LedgerEntry[],
  metrics: readonly MetricDefinition[],
  now: Date,
): { php: number; weeksCounted: number } {
  const revenueMetric = metrics.find((m) => m.key === "revenue_php") ?? metrics.find((m) => m.unit === "php");
  if (!revenueMetric) return { php: 0, weeksCounted: 0 };
  const thisWeek = weekStartOf(now);
  const windowStart = addWeeks(thisWeek, -3);
  const inWindow = entries.filter((e) => e.weekStarting >= windowStart && e.weekStarting <= thisWeek);
  return {
    php: inWindow.reduce((s, e) => s + (e.values[revenueMetric.key] ?? 0), 0),
    weeksCounted: inWindow.length,
  };
}

export function profitabilityProgress(
  entries: readonly LedgerEntry[],
  venture: Pick<Venture, "metrics" | "unitEconomics" | "profitabilityTarget">,
  now: Date,
): ProfitabilityProgress {
  const { php: runRate, weeksCounted } = revenueRunRate(entries, venture.metrics, now);
  const margin = contributionMargin(venture.unitEconomics);
  const contribution = Math.round(runRate * margin);
  const target = venture.profitabilityTarget.monthlyContributionPhp;
  return {
    runRateRevenuePhp: runRate,
    marginPct: Math.round(margin * 100),
    contributionPhp: contribution,
    targetPhp: target,
    pct: target > 0 ? Math.min(100, Math.round((contribution / target) * 100)) : 0,
    weeksCounted,
  };
}
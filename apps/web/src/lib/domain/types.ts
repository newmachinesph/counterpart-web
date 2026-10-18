/**
 * Canonical domain types for Counterpart.
 *
 * Vocabulary (keep consistent in code and copy):
 * - Venture: a listed product that already works and needs commercial traction
 * - Bench: the public directory of ventures open for pairing
 * - Counterpart: the commercial half of a founding pair
 * - Pairing: an active engagement between a builder and a Counterpart
 * - Proving run: an accepted paid trial without automatic equity
 * - Milestone: a traction target that unlocks a vesting tranche
 * - Traction ledger: the weekly log of real numbers against milestones
 * - Release: ending a Pairing; vested equity stays vested
 *
 * All timestamps are ISO 8601 strings. Calendar dates (week starts) are
 * YYYY-MM-DD strings. Domain functions take `now: Date` explicitly so they
 * are deterministic and testable.
 */

export type Role = "builder" | "counterpart" | "investor" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  emailVerifiedAt?: string | null;
  platformTermsVersion?: string | null;
  /** One line of what they have done. Shown on applications and pairings. */
  headline?: string;
  location?: string;
}

export const VENTURE_CATEGORIES = [
  "loyalty",
  "fintech",
  "saas",
  "marketplace",
  "ecommerce",
  "logistics",
  "other",
] as const;
export type VentureCategory = (typeof VENTURE_CATEGORIES)[number];

export const VENTURE_STAGES = ["development", "live", "first_revenue", "growing"] as const;
export type VentureStage = (typeof VENTURE_STAGES)[number];

export type VentureStatus = "draft" | "published" | "development";

/** How weekly ledger values roll up into a single number for a metric. */
export type MetricAggregation = "sum" | "latest";

export interface MetricDefinition {
  key: string;
  label: string;
  unit: "php" | "count";
  /**
   * `sum`: cumulative total of weekly values (flows, e.g. revenue).
   * `latest`: the most recent weekly value (stocks, e.g. merchants live).
   */
  aggregation: MetricAggregation;
}

export interface PricingPlan {
  name: string;
  pricePhpMonthly: number;
  includes: string;
}

/** Per-unit economics on a monthly basis. Contribution excludes tech, infra, and salaries. */
export interface UnitEconomics {
  unitLabel: string;
  revenuePerUnitPhpMonthly: number;
  variableCostPerUnitPhpMonthly: number;
  note: string;
}

/**
 * Target profitability: monthly contribution profit (revenue minus variable
 * costs) the pairing is aiming for, and by when. Tech, infrastructure, and
 * salaries are excluded on purpose; this is the commercial engine's number.
 */
export interface ProfitabilityTarget {
  monthlyContributionPhp: number;
  withinDays: number;
  excludes: string[];
}

export type Track = "counterpart" | "intern";

export interface Venture {
  id: string;
  slug: string;
  name: string;
  oneLiner: string;
  description: string;
  category: VentureCategory;
  stage: VentureStage;
  status: VentureStatus;
  builderId: string;
  /** City or province. */
  location?: string;
  /** Live product URL. Publishing requires it to be reachable. */
  productUrl: string;
  /** Set by the publish check when the product URL last answered. */
  productUrlVerifiedAt: string | null;
  /** Publishing requires at least one. */
  screenshots: string[];
  logoUrl?: string | null;
  tractionSummary: string;
  equityMinPct: number;
  equityMaxPct: number;
  hoursPerWeek: number;
  builderHasDone: string[];
  counterpartWouldOwn: string[];
  metrics: MetricDefinition[];
  pricing: PricingPlan[];
  unitEconomics: UnitEconomics;
  profitabilityTarget: ProfitabilityTarget;
  internsWelcome: boolean;
  vestingTerms: string;
  termsTemplateId: string;
  commercialTerms?: CommercialTerms;
  createdAt: string;
}

export type MilestoneStatus = "locked" | "open" | "cleared" | "missed";

export interface Milestone {
  id: string;
  ventureId: string;
  /** 1-based order. Milestones open in sequence. */
  sequence: number;
  title: string;
  metricKey: string;
  targetValue: number;
  tranchePct: number;
  windowDays: number;
  /** Marks the performance goal associated with the initial trial. */
  isProvingRun: boolean;
  status: MilestoneStatus;
  openedAt: string | null;
  clearedAt: string | null;
  missedAt: string | null;
  clearedByLedgerEntryId: string | null;
}

export const PAIRING_STATES = [
  "offered", "declined", "cofounder",
  "proving_run",
  "active",
  "released",
  "lapsed",
  "completed",
] as const;
export type PairingState = (typeof PAIRING_STATES)[number];

export interface Pairing {
  id: string;
  ventureId: string;
  builderId: string;
  counterpartId: string;
  state: PairingState;
  protocol?: string;
  offeredAt?: string | null;
  acceptedAt?: string | null;
  agreement?: AgreementSnapshot;
  milestoneSnapshot?: Milestone[];
  continuationRequestedAt?: string | null;
  startedAt: string;
  provingRunDays: number;
  provingRunDeliverables: string[];
  convertedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  endReason: string | null;
}

export interface LedgerComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  pairingId: string;
  /** YYYY-MM-DD, always a Monday. */
  weekStarting: string;
  values: Record<string, number>;
  note: string;
  evidenceLinks: string[];
  submittedAt: string;
  updatedAt: string;
  comments: LedgerComment[];
}

/** Earned equity. Never deleted, never reduced. */
export interface VestingEntry {
  id: string;
  pairingId: string;
  milestoneId: string;
  tranchePct: number;
  vestedAt: string;
  /** The ledger entry whose numbers cleared the milestone. */
  ledgerEntryId: string;
}

/** A future tranche that will never vest. Separate from release of the role. */
export interface VoidedTranche {
  id: string;
  pairingId: string;
  milestoneId: string;
  tranchePct: number;
  voidedAt: string;
  reason: "missed" | "released" | "lapsed";
}

export type ApplicationStatus =
  | "submitted"
  | "shortlisted"
  | "declined"
  | "invited";

export type Compensation = "cash" | "equity_only" | "equity_plus_salary";

export interface NumbersMoved {
  metric: string;
  before: string;
  after: string;
  timeframe: string;
}

export interface Application {
  id: string;
  ventureId: string;
  applicantId: string;
  evidence: string;
  proofLinks: string[];
  numbersMoved: NumbersMoved[];
  hoursPerWeek: number;
  compensation: Compensation;
  track: Track;
  /** What they are asking for. Capped by the venture range and the platform cap. */
  requestedEquityPct: number;
  templateId: string;
  /** Resources they commit beyond hours: transport, network, tools, savings runway. */
  commitments: string[];
  acknowledgesResourceClause: boolean;
  whyThisVenture: string;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt: string | null;
}

export const OPENING_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];

export const WORK_ARRANGEMENTS = ["onsite", "hybrid", "remote"] as const;
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];

/**
 * Where the money for a paid role comes from. A venture role funded by
 * `ledger_revenue` shows the figure computed from its traction ledger, so a
 * paid opening can never claim money the ledger has not seen.
 */
export const FUNDING_SOURCES = ["ledger_revenue", "outside_funding", "commission_only", "equity_only"] as const;
export type FundedBy = (typeof FUNDING_SOURCES)[number];

export type OpeningStatus = "open" | "closed" | "filled";

export interface Opening {
  compensationDetails?: string;
  id: string;
  /** null means Counterpart itself is hiring. */
  ventureId: string | null;
  title: string;
  team: string;
  type: OpeningType;
  arrangement: WorkArrangement;
  location: string;
  summary: string;
  responsibilities: string[];
  /** Evidence-first, like an application. Never a degree or an employer. */
  lookingFor: string[];
  salaryMinPhpMonthly: number | null;
  salaryMaxPhpMonthly: number | null;
  /** A small sweetener. A real stake is a Counterpart seat, not a job. */
  equityPct: number | null;
  fundedBy: FundedBy;
  status: OpeningStatus;
  postedById: string;
  createdAt: string;
  closesAt: string | null;
}

export type JobApplicationStatus = "submitted" | "shortlisted" | "declined" | "hired" | "offered";

export interface JobApplication {
  id: string;
  openingId: string;
  applicantId: string;
  evidence: string;
  proofLinks: string[];
  availableFrom: string;
  expectedSalaryPhpMonthly: number | null;
  offerSnapshot?: { title: string; compensationDetails: string; salaryPhpMonthly: number; version: string; hash: string };
  whyThisRole: string;
  status: JobApplicationStatus;
  submittedAt: string;
  decidedAt: string | null;
}

export interface TermsSection {
  heading: string;
  body: string;
}

export interface TermsTemplate {
  id: string;
  title: string;
  reviewNote: string;
  sections: TermsSection[];
}

export interface Notification {
  id: string;
  userId: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface CommercialTerms {
 trialDays: number; termDays: number; monthlyFeePhp: string | number; commissionRatePct: string | number;
 eligibleRevenue: string; attribution: string; paymentDays: number; tailDays: number;
 expensePolicy: string; contractingParty: string; disputeProcess: string;
}
export interface AgreementSnapshot {
 template: TermsTemplate; values: Record<string,string>; terms: CommercialTerms; hash: string;
 metrics: MetricDefinition[]; schedule: Milestone[]; applicationId: string;
}

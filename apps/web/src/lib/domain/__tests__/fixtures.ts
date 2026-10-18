import type {
  LedgerEntry,
  MetricDefinition,
  Milestone,
  Pairing,
} from "../types";

export const METRICS: MetricDefinition[] = [
  { key: "merchants_live", label: "Merchants live", unit: "count", aggregation: "latest" },
  { key: "revenue_php", label: "Revenue", unit: "php", aggregation: "sum" },
  { key: "paying_users", label: "Paying users", unit: "count", aggregation: "latest" },
];

export function makePairing(overrides: Partial<Pairing> = {}): Pairing {
  return {
    id: "pair_1",
    ventureId: "ven_1",
    builderId: "usr_builder",
    counterpartId: "usr_cp",
    state: "proving_run",
    startedAt: "2026-06-01T00:00:00.000Z",
    provingRunDays: 45,
    provingRunDeliverables: [],
    convertedAt: null,
    endedAt: null,
    endedBy: null,
    endReason: null,
    ...overrides,
  };
}

let milestoneSeq = 0;
export function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  milestoneSeq += 1;
  return {
    id: `ms_${milestoneSeq}`,
    ventureId: "ven_1",
    sequence: milestoneSeq,
    title: `Milestone ${milestoneSeq}`,
    metricKey: "revenue_php",
    targetValue: 1000,
    tranchePct: 1,
    windowDays: 30,
    isProvingRun: false,
    status: "locked",
    openedAt: null,
    clearedAt: null,
    missedAt: null,
    clearedByLedgerEntryId: null,
    ...overrides,
  };
}

/** The KYP Stamping schedule from the spec, all locked. */
export function kypMilestones(): Milestone[] {
  return [
    makeMilestone({ id: "ms_a", sequence: 1, title: "Proving run: first merchants", metricKey: "merchants_live", targetValue: 3, tranchePct: 2, windowDays: 45, isProvingRun: true }),
    makeMilestone({ id: "ms_b", sequence: 2, title: "First revenue", metricKey: "revenue_php", targetValue: 25000, tranchePct: 2, windowDays: 90 }),
    makeMilestone({ id: "ms_c", sequence: 3, title: "Ten merchants live", metricKey: "merchants_live", targetValue: 10, tranchePct: 3, windowDays: 120 }),
    makeMilestone({ id: "ms_d", sequence: 4, title: "Hundred paying users", metricKey: "paying_users", targetValue: 100, tranchePct: 5, windowDays: 180 }),
  ];
}

let entrySeq = 0;
export function makeEntry(
  weekStarting: string,
  values: Record<string, number>,
  overrides: Partial<LedgerEntry> = {},
): LedgerEntry {
  entrySeq += 1;
  const submittedAt = `${weekStarting}T09:00:00.000Z`;
  return {
    id: `le_${entrySeq}`,
    pairingId: "pair_1",
    weekStarting,
    values,
    note: "",
    evidenceLinks: [],
    submittedAt,
    updatedAt: submittedAt,
    comments: [],
    ...overrides,
  };
}

export const d = (iso: string) => new Date(iso);

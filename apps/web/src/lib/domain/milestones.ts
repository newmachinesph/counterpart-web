import { DAY_MS } from "./pairing";
import { firstEntryReaching, parseDateOnly } from "./ledger";
import type {
  LedgerEntry,
  MetricDefinition,
  Milestone,
  Pairing,
  VestingEntry,
  VoidedTranche,
} from "./types";

/**
 * Milestone auto-clear and vesting.
 *
 * - Milestones open in sequence; only one is open at a time.
 * - The first opens when the pairing starts. Each next one opens the moment
 *   the previous one clears or misses.
 * - A milestone clears when the ledger's aggregated value for its metric
 *   reaches the target, using a ledger week that started on or before the
 *   window deadline. Clearing is computed, never clicked.
 * - Clearing writes the tranche to the vesting ledger with the triggering entry.
 * - If the window expires unmet, the milestone is missed, the tranche is
 *   voided, and both parties are notified. Voiding a future tranche is a
 *   separate thing from releasing the role; this module only does the former.
 *
 * Pure: never mutates inputs, idempotent on repeated runs.
 */

export type MilestoneEvent =
  | { type: "opened"; milestoneId: string; at: string }
  | { type: "cleared"; milestoneId: string; at: string; ledgerEntryId: string }
  | { type: "missed"; milestoneId: string; at: string };

export interface PendingNotification {
  userId: string;
  body: string;
}

export interface EvaluationInput {
  milestones: readonly Milestone[];
  entries: readonly LedgerEntry[];
  metrics: readonly MetricDefinition[];
  pairing: Pairing;
  now: Date;
  newId?: (prefix: string) => string;
}

export interface EvaluationResult {
  milestones: Milestone[];
  vested: VestingEntry[];
  voided: VoidedTranche[];
  notifications: PendingNotification[];
  events: MilestoneEvent[];
  /** Set when the proving-run milestone changed state in this run. */
  provingRunOutcome: "cleared" | "missed" | null;
  allCleared: boolean;
}

function defaultId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function milestoneDeadline(milestone: Milestone): Date | null {
  if (!milestone.openedAt) return null;
  return new Date(new Date(milestone.openedAt).getTime() + milestone.windowDays * DAY_MS);
}

export function totalOnOffer(milestones: readonly Milestone[]): number {
  return round(milestones.reduce((sum, m) => sum + m.tranchePct, 0));
}

export function vestedTotal(entries: readonly VestingEntry[]): number {
  return round(entries.reduce((sum, v) => sum + v.tranchePct, 0));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function evaluateMilestones(input: EvaluationInput): EvaluationResult {
  const newId = input.newId ?? defaultId;
  const metricsByKey = new Map(input.metrics.map((m) => [m.key, m] as const));
  const ordered = [...input.milestones].sort((a, b) => a.sequence - b.sequence);

  const vested: VestingEntry[] = [];
  const voided: VoidedTranche[] = [];
  const notifications: PendingNotification[] = [];
  const events: MilestoneEvent[] = [];
  let provingRunOutcome: EvaluationResult["provingRunOutcome"] = null;

  // The instant the next locked milestone may open, or null while one is open.
  let openAt: string | null = input.pairing.startedAt;

  const result: Milestone[] = [];
  for (const original of ordered) {
    let milestone = original;

    if (milestone.status === "cleared" || milestone.status === "missed") {
      openAt = milestone.clearedAt ?? milestone.missedAt;
      result.push(milestone);
      continue;
    }

    if (milestone.status === "locked") {
      if (openAt === null) {
        result.push(milestone);
        continue;
      }
      milestone = { ...milestone, status: "open", openedAt: openAt };
      events.push({ type: "opened", milestoneId: milestone.id, at: openAt });
    }

    const metric = metricsByKey.get(milestone.metricKey);
    if (!metric) {
      throw new Error(`Milestone ${milestone.id} references unknown metric "${milestone.metricKey}"`);
    }
    const deadline = milestoneDeadline(milestone);
    if (!deadline) {
      throw new Error(`Open milestone ${milestone.id} has no openedAt`);
    }

    const trigger = firstEntryReaching(input.entries, metric, milestone.targetValue);
    const triggerWithinWindow =
      trigger !== null && parseDateOnly(trigger.weekStarting).getTime() <= deadline.getTime();

    if (triggerWithinWindow) {
      const at = trigger.updatedAt;
      milestone = {
        ...milestone,
        status: "cleared",
        clearedAt: at,
        clearedByLedgerEntryId: trigger.id,
      };
      vested.push({
        id: newId("vest"),
        pairingId: input.pairing.id,
        milestoneId: milestone.id,
        tranchePct: milestone.tranchePct,
        vestedAt: at,
        ledgerEntryId: trigger.id,
      });
      events.push({ type: "cleared", milestoneId: milestone.id, at, ledgerEntryId: trigger.id });
      if (milestone.isProvingRun) provingRunOutcome = "cleared";
      openAt = at;
      result.push(milestone);
      continue;
    }

    if (input.now.getTime() >= deadline.getTime()) {
      const at = deadline.toISOString();
      milestone = { ...milestone, status: "missed", missedAt: at };
      voided.push({
        id: newId("void"),
        pairingId: input.pairing.id,
        milestoneId: milestone.id,
        tranchePct: milestone.tranchePct,
        voidedAt: at,
        reason: "missed",
      });
      const body = `Milestone "${milestone.title}" was not met within ${milestone.windowDays} days. Its ${milestone.tranchePct}% tranche is voided.`;
      notifications.push({ userId: input.pairing.builderId, body });
      notifications.push({ userId: input.pairing.counterpartId, body });
      events.push({ type: "missed", milestoneId: milestone.id, at });
      if (milestone.isProvingRun) provingRunOutcome = "missed";
      openAt = at;
      result.push(milestone);
      continue;
    }

    // Still open and inside its window. Nothing after it may open.
    openAt = null;
    result.push(milestone);
  }

  return {
    milestones: result,
    vested,
    voided,
    notifications,
    events,
    provingRunOutcome,
    allCleared: result.length > 0 && result.every((m) => m.status === "cleared"),
  };
}

/** Void every tranche that has not vested. Used on release and lapse. */
export function voidUnvested(
  milestones: readonly Milestone[],
  pairingId: string,
  reason: "released" | "lapsed",
  now: Date,
  newId: (prefix: string) => string = defaultId,
): VoidedTranche[] {
  return milestones
    .filter((m) => m.status === "open" || m.status === "locked")
    .map((m) => ({
      id: newId("void"),
      pairingId,
      milestoneId: m.id,
      tranchePct: m.tranchePct,
      voidedAt: now.toISOString(),
      reason,
    }));
}

/** Reset a venture's milestones so the next Pairing starts from locked. */
export function resetMilestones(milestones: readonly Milestone[]): Milestone[] {
  return milestones.map((m) => ({
    ...m,
    status: "locked",
    openedAt: null,
    clearedAt: null,
    missedAt: null,
    clearedByLedgerEntryId: null,
  }));
}

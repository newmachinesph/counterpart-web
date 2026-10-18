import type { LedgerComment, LedgerEntry, MetricDefinition } from "./types";

/**
 * Traction ledger rules.
 *
 * - Weeks start on Monday and are identified by a YYYY-MM-DD date string.
 * - A week closes 7 days after it starts. Closed entries are read-only.
 * - One entry per pairing per week; re-submitting edits until the week closes.
 * - Missing weeks are surfaced as gaps, never hidden.
 * - Comments can be added at any time and never touch the numbers.
 *
 * All date math is done in UTC so results do not depend on server timezone.
 */

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class WeekClosedError extends Error {
  readonly weekStarting: string;
  constructor(weekStarting: string) {
    super(`The week starting ${weekStarting} has closed and its entry is read-only`);
    this.name = "WeekClosedError";
    this.weekStarting = weekStarting;
  }
}

export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(date: string): Date {
  if (!DATE_RE.test(date)) {
    throw new LedgerValidationError(`Expected a YYYY-MM-DD date, got "${date}"`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new LedgerValidationError(`Invalid date "${date}"`);
  }
  return parsed;
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The Monday on or before `date`, as YYYY-MM-DD (UTC). */
export function weekStartOf(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay(); // 0 = Sunday
  const offset = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return toDateOnly(utc);
}

export function isMonday(weekStarting: string): boolean {
  return parseDateOnly(weekStarting).getUTCDay() === 1;
}

export function weekCloseAt(weekStarting: string): Date {
  return new Date(parseDateOnly(weekStarting).getTime() + WEEK_MS);
}

export function isWeekClosed(weekStarting: string, now: Date): boolean {
  return now.getTime() >= weekCloseAt(weekStarting).getTime();
}

export function addWeeks(weekStarting: string, weeks: number): string {
  return toDateOnly(new Date(parseDateOnly(weekStarting).getTime() + weeks * WEEK_MS));
}

export interface LedgerEntryInput {
  pairingId: string;
  weekStarting: string;
  values: Record<string, number>;
  note: string;
  evidenceLinks: string[];
}

export interface UpsertContext {
  now: Date;
  metrics: readonly MetricDefinition[];
  newId?: () => string;
}

export interface UpsertResult {
  entries: LedgerEntry[];
  entry: LedgerEntry;
  created: boolean;
}

function validateValues(values: Record<string, number>, metrics: readonly MetricDefinition[]): void {
  const allowed = new Set(metrics.map((m) => m.key));
  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) {
      throw new LedgerValidationError(`"${key}" is not a metric on this venture`);
    }
  }
  for (const metric of metrics) {
    const value = values[metric.key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new LedgerValidationError(`A number is required for ${metric.label}`);
    }
    if (value < 0) {
      throw new LedgerValidationError(`${metric.label} cannot be negative`);
    }
  }
}

function defaultId(): string {
  return `le_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create or edit the entry for a week. Returns a new entries array.
 * Throws WeekClosedError if the week has already closed.
 */
export function upsertLedgerEntry(
  entries: readonly LedgerEntry[],
  input: LedgerEntryInput,
  ctx: UpsertContext,
): UpsertResult {
  const { weekStarting } = input;
  if (!isMonday(weekStarting)) {
    throw new LedgerValidationError(`Week must start on a Monday, got ${weekStarting}`);
  }
  if (parseDateOnly(weekStarting).getTime() > ctx.now.getTime()) {
    throw new LedgerValidationError(`The week starting ${weekStarting} has not started yet`);
  }
  if (isWeekClosed(weekStarting, ctx.now)) {
    throw new WeekClosedError(weekStarting);
  }
  validateValues(input.values, ctx.metrics);

  const at = ctx.now.toISOString();
  const existing = entries.find(
    (e) => e.pairingId === input.pairingId && e.weekStarting === weekStarting,
  );

  if (existing) {
    const updated: LedgerEntry = {
      ...existing,
      values: { ...input.values },
      note: input.note,
      evidenceLinks: [...input.evidenceLinks],
      updatedAt: at,
    };
    return {
      entries: entries.map((e) => (e.id === existing.id ? updated : e)),
      entry: updated,
      created: false,
    };
  }

  const created: LedgerEntry = {
    id: (ctx.newId ?? defaultId)(),
    pairingId: input.pairingId,
    weekStarting,
    values: { ...input.values },
    note: input.note,
    evidenceLinks: [...input.evidenceLinks],
    submittedAt: at,
    updatedAt: at,
    comments: [],
  };
  return { entries: [...entries, created], entry: created, created: true };
}

/** Builder commentary. Allowed on any entry, open or closed. Numbers untouched. */
export function addLedgerComment(
  entries: readonly LedgerEntry[],
  entryId: string,
  comment: { authorId: string; body: string },
  now: Date,
  newId: () => string = () => `lc_${Math.random().toString(36).slice(2, 10)}`,
): LedgerEntry[] {
  const body = comment.body.trim();
  if (!body) {
    throw new LedgerValidationError("Comment cannot be empty");
  }
  const target = entries.find((e) => e.id === entryId);
  if (!target) {
    throw new LedgerValidationError(`No ledger entry ${entryId}`);
  }
  const next: LedgerComment = {
    id: newId(),
    authorId: comment.authorId,
    body,
    createdAt: now.toISOString(),
  };
  return entries.map((e) =>
    e.id === entryId ? { ...e, comments: [...e.comments, next] } : e,
  );
}

export function sortByWeek(entries: readonly LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => a.weekStarting.localeCompare(b.weekStarting));
}

export interface LedgerWeek {
  weekStarting: string;
  entry: LedgerEntry | null;
  closed: boolean;
}

/** Every week from `fromWeek` through the week containing `now`. Gaps are explicit. */
export function ledgerWeeks(
  entries: readonly LedgerEntry[],
  fromWeek: string,
  now: Date,
): LedgerWeek[] {
  const byWeek = new Map(entries.map((e) => [e.weekStarting, e] as const));
  const last = weekStartOf(now);
  const weeks: LedgerWeek[] = [];
  let cursor = weekStartOf(parseDateOnly(fromWeek));
  while (cursor <= last) {
    weeks.push({
      weekStarting: cursor,
      entry: byWeek.get(cursor) ?? null,
      closed: isWeekClosed(cursor, now),
    });
    cursor = addWeeks(cursor, 1);
  }
  return weeks;
}

/** Roll a metric up across entries: cumulative sum for flows, latest week for stocks. */
export function aggregateMetric(
  entries: readonly LedgerEntry[],
  metric: MetricDefinition,
): number {
  const sorted = sortByWeek(entries);
  if (sorted.length === 0) return 0;
  if (metric.aggregation === "sum") {
    return sorted.reduce((total, e) => total + (e.values[metric.key] ?? 0), 0);
  }
  return sorted[sorted.length - 1].values[metric.key] ?? 0;
}

/**
 * Walk the ledger week by week and return the first entry at which the
 * aggregated metric reaches `target`, or null. Used by milestone clearing.
 */
export function firstEntryReaching(
  entries: readonly LedgerEntry[],
  metric: MetricDefinition,
  target: number,
): LedgerEntry | null {
  let running = 0;
  for (const entry of sortByWeek(entries)) {
    const value = entry.values[metric.key] ?? 0;
    running = metric.aggregation === "sum" ? running + value : value;
    if (running >= target) return entry;
  }
  return null;
}

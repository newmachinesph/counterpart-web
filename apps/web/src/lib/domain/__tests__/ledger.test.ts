import { describe, expect, it } from "vitest";
import {
  LedgerValidationError,
  WeekClosedError,
  addLedgerComment,
  aggregateMetric,
  isWeekClosed,
  ledgerWeeks,
  upsertLedgerEntry,
  weekCloseAt,
  weekStartOf,
} from "../ledger";
import { METRICS, d, makeEntry } from "./fixtures";

const V = (merchants_live: number, revenue_php: number, paying_users: number) => ({
  merchants_live,
  revenue_php,
  paying_users,
});

describe("week boundaries", () => {
  it("weekStartOf returns the Monday of the week as YYYY-MM-DD", () => {
    expect(weekStartOf(d("2026-06-01T10:00:00Z"))).toBe("2026-06-01"); // Monday
    expect(weekStartOf(d("2026-06-03T10:00:00Z"))).toBe("2026-06-01"); // Wednesday
    expect(weekStartOf(d("2026-06-07T23:59:59Z"))).toBe("2026-06-01"); // Sunday
    expect(weekStartOf(d("2026-06-08T00:00:00Z"))).toBe("2026-06-08"); // next Monday
  });

  it("a week closes exactly 7 days after it starts", () => {
    expect(weekCloseAt("2026-06-01").toISOString()).toBe("2026-06-08T00:00:00.000Z");
    expect(isWeekClosed("2026-06-01", d("2026-06-07T23:59:59Z"))).toBe(false);
    expect(isWeekClosed("2026-06-01", d("2026-06-08T00:00:00Z"))).toBe(true);
  });
});

describe("upsertLedgerEntry", () => {
  const base = { pairingId: "pair_1", note: "first week", evidenceLinks: [] as string[] };
  const ctx = (iso: string) => ({ now: d(iso), metrics: METRICS });

  it("creates a new entry for a week that has none", () => {
    const result = upsertLedgerEntry(
      [],
      { ...base, weekStarting: "2026-06-01", values: V(1, 0, 0) },
      ctx("2026-06-03T10:00:00Z"),
    );
    expect(result.created).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entry.weekStarting).toBe("2026-06-01");
    expect(result.entry.submittedAt).toBe("2026-06-03T10:00:00.000Z");
  });

  it("submitting again for the same open week edits the existing entry", () => {
    const first = upsertLedgerEntry(
      [],
      { ...base, weekStarting: "2026-06-01", values: V(1, 0, 0) },
      ctx("2026-06-02T10:00:00Z"),
    );
    const second = upsertLedgerEntry(
      first.entries,
      { ...base, weekStarting: "2026-06-01", note: "corrected", values: V(2, 500, 0) },
      ctx("2026-06-05T10:00:00Z"),
    );
    expect(second.created).toBe(false);
    expect(second.entries).toHaveLength(1);
    expect(second.entry.id).toBe(first.entry.id);
    expect(second.entry.values.merchants_live).toBe(2);
    expect(second.entry.note).toBe("corrected");
    expect(second.entry.submittedAt).toBe(first.entry.submittedAt);
    expect(second.entry.updatedAt).toBe("2026-06-05T10:00:00.000Z");
  });

  it("refuses to edit an entry once its week has closed", () => {
    const first = upsertLedgerEntry(
      [],
      { ...base, weekStarting: "2026-06-01", values: V(1, 0, 0) },
      ctx("2026-06-02T10:00:00Z"),
    );
    expect(() =>
      upsertLedgerEntry(
        first.entries,
        { ...base, weekStarting: "2026-06-01", values: V(9, 0, 0) },
        ctx("2026-06-08T00:00:00Z"),
      ),
    ).toThrow(WeekClosedError);
  });

  it("refuses to create an entry for a week that has already closed", () => {
    expect(() =>
      upsertLedgerEntry(
        [],
        { ...base, weekStarting: "2026-06-01", values: V(1, 0, 0) },
        ctx("2026-06-20T00:00:00Z"),
      ),
    ).toThrow(WeekClosedError);
  });

  it("refuses a week that has not started yet", () => {
    expect(() =>
      upsertLedgerEntry(
        [],
        { ...base, weekStarting: "2026-06-08", values: V(1, 0, 0) },
        ctx("2026-06-05T00:00:00Z"),
      ),
    ).toThrow(LedgerValidationError);
  });

  it("refuses a weekStarting that is not a Monday", () => {
    expect(() =>
      upsertLedgerEntry(
        [],
        { ...base, weekStarting: "2026-06-02", values: V(1, 0, 0) },
        ctx("2026-06-03T00:00:00Z"),
      ),
    ).toThrow(LedgerValidationError);
  });

  it("requires a value for every metric and rejects unknown or negative values", () => {
    const c = ctx("2026-06-03T00:00:00Z");
    expect(() =>
      upsertLedgerEntry([], { ...base, weekStarting: "2026-06-01", values: { merchants_live: 1 } }, c),
    ).toThrow(LedgerValidationError);
    expect(() =>
      upsertLedgerEntry([], { ...base, weekStarting: "2026-06-01", values: V(1, -5, 0) }, c),
    ).toThrow(LedgerValidationError);
    expect(() =>
      upsertLedgerEntry(
        [],
        { ...base, weekStarting: "2026-06-01", values: { ...V(1, 0, 0), bogus: 1 } },
        c,
      ),
    ).toThrow(LedgerValidationError);
  });

  it("does not mutate the input entries array", () => {
    const existing = Object.freeze([makeEntry("2026-05-25", V(1, 0, 0))]);
    const result = upsertLedgerEntry(
      existing as never,
      { ...base, weekStarting: "2026-06-01", values: V(1, 0, 0) },
      ctx("2026-06-03T00:00:00Z"),
    );
    expect(existing).toHaveLength(1);
    expect(result.entries).toHaveLength(2);
  });
});

describe("comments", () => {
  it("can be added to a closed week and never change the numbers", () => {
    const entries = [makeEntry("2026-06-01", V(1, 0, 0))];
    const result = addLedgerComment(
      entries,
      entries[0].id,
      { authorId: "usr_builder", body: "Which merchants?" },
      d("2026-07-01T00:00:00Z"),
    );
    expect(result[0].comments).toHaveLength(1);
    expect(result[0].comments[0].body).toBe("Which merchants?");
    expect(result[0].values).toEqual(entries[0].values);
    expect(entries[0].comments).toHaveLength(0);
  });
});

describe("ledgerWeeks and gaps", () => {
  it("lists every week from the start to now, with null for missing weeks", () => {
    const entries = [makeEntry("2026-06-01", V(1, 0, 0)), makeEntry("2026-06-15", V(2, 100, 0))];
    const weeks = ledgerWeeks(entries, "2026-06-01", d("2026-06-24T00:00:00Z"));
    expect(weeks.map((w) => w.weekStarting)).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
    ]);
    expect(weeks.map((w) => (w.entry ? "entry" : "gap"))).toEqual(["entry", "gap", "entry", "gap"]);
    expect(weeks.map((w) => w.closed)).toEqual([true, true, true, false]);
  });
});

describe("aggregateMetric", () => {
  const entries = [
    makeEntry("2026-06-01", V(1, 100, 0)),
    makeEntry("2026-06-15", V(3, 250, 5)),
    makeEntry("2026-06-08", V(2, 50, 2)),
  ];

  it("sums flow metrics across all weeks", () => {
    expect(aggregateMetric(entries, METRICS[1])).toBe(400);
  });

  it("takes the latest week for stock metrics regardless of array order", () => {
    expect(aggregateMetric(entries, METRICS[0])).toBe(3);
  });

  it("returns 0 with no entries", () => {
    expect(aggregateMetric([], METRICS[1])).toBe(0);
  });
});

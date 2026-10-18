import { describe, expect, it } from "vitest";
import { evaluateMilestones, totalOnOffer, vestedTotal } from "../milestones";
import { METRICS, d, kypMilestones, makeEntry, makePairing } from "./fixtures";

const START = "2026-06-01T00:00:00.000Z";
const pairing = makePairing({ startedAt: START });
const V = (merchants_live: number, revenue_php: number, paying_users: number) => ({
  merchants_live,
  revenue_php,
  paying_users,
});

function run(entries: ReturnType<typeof makeEntry>[], now: string, milestones = kypMilestones()) {
  return evaluateMilestones({ milestones, entries, metrics: METRICS, pairing, now: d(now) });
}

describe("opening in sequence", () => {
  it("opens only the first milestone when the pairing starts, at the pairing start time", () => {
    const r = run([], "2026-06-01T00:00:00Z");
    expect(r.milestones.map((m) => m.status)).toEqual(["open", "locked", "locked", "locked"]);
    expect(r.milestones[0].openedAt).toBe(START);
    expect(r.vested).toHaveLength(0);
    expect(r.voided).toHaveLength(0);
  });

  it("is idempotent: re-running with the same inputs changes nothing", () => {
    const first = run([], "2026-06-10T00:00:00Z");
    const second = evaluateMilestones({
      milestones: first.milestones,
      entries: [],
      metrics: METRICS,
      pairing,
      now: d("2026-06-10T00:00:00Z"),
    });
    expect(second.milestones).toEqual(first.milestones);
    expect(second.vested).toHaveLength(0);
    expect(second.events).toHaveLength(0);
  });

  it("does not mutate the input milestones", () => {
    const input = kypMilestones();
    const snapshot = JSON.stringify(input);
    run([makeEntry("2026-06-01", V(3, 0, 0))], "2026-06-05T00:00:00Z", input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("clearing", () => {
  it("clears when the aggregated metric reaches the target and vests the tranche with the triggering entry", () => {
    const entries = [
      makeEntry("2026-06-01", V(1, 0, 0), { id: "le_w1" }),
      makeEntry("2026-06-08", V(3, 0, 0), { id: "le_w2" }),
    ];
    const r = run(entries, "2026-06-10T00:00:00Z");
    const [first, second] = r.milestones;
    expect(first.status).toBe("cleared");
    expect(first.clearedByLedgerEntryId).toBe("le_w2");
    expect(first.clearedAt).toBe(entries[1].updatedAt);
    expect(r.vested).toHaveLength(1);
    expect(r.vested[0]).toMatchObject({
      milestoneId: "ms_a",
      tranchePct: 2,
      ledgerEntryId: "le_w2",
      vestedAt: entries[1].updatedAt,
    });
    expect(second.status).toBe("open");
    expect(second.openedAt).toBe(first.clearedAt);
  });

  it("does not clear below target", () => {
    const r = run([makeEntry("2026-06-01", V(2, 0, 0))], "2026-06-05T00:00:00Z");
    expect(r.milestones[0].status).toBe("open");
    expect(r.vested).toHaveLength(0);
  });

  it("uses cumulative sum for flow metrics", () => {
    const cleared = kypMilestones().map((m) =>
      m.sequence === 1
        ? { ...m, status: "cleared" as const, openedAt: START, clearedAt: START, clearedByLedgerEntryId: "le_x" }
        : m,
    );
    const entries = [
      makeEntry("2026-06-01", V(3, 10000, 0)),
      makeEntry("2026-06-08", V(3, 10000, 0)),
      makeEntry("2026-06-15", V(3, 5000, 0), { id: "le_rev" }),
    ];
    const r = run(entries, "2026-06-20T00:00:00Z", cleared);
    expect(r.milestones[1].status).toBe("cleared");
    expect(r.milestones[1].clearedByLedgerEntryId).toBe("le_rev");
    expect(r.vested.map((v) => v.milestoneId)).toEqual(["ms_b"]);
  });

  it("clears several milestones in one pass when the ledger already covers them", () => {
    const entries = [
      makeEntry("2026-06-01", V(3, 25000, 0), { id: "le_1" }),
      makeEntry("2026-06-08", V(10, 0, 100), { id: "le_2" }),
    ];
    const r = run(entries, "2026-06-10T00:00:00Z");
    expect(r.milestones.map((m) => m.status)).toEqual(["cleared", "cleared", "cleared", "cleared"]);
    expect(r.vested.map((v) => v.tranchePct)).toEqual([2, 2, 3, 5]);
    expect(r.allCleared).toBe(true);
  });

  it("never vests a tranche twice", () => {
    const entries = [makeEntry("2026-06-01", V(3, 0, 0))];
    const first = run(entries, "2026-06-05T00:00:00Z");
    const second = evaluateMilestones({
      milestones: first.milestones,
      entries,
      metrics: METRICS,
      pairing,
      now: d("2026-06-06T00:00:00Z"),
    });
    expect(second.vested).toHaveLength(0);
  });
});

describe("missing", () => {
  it("marks the open milestone missed once its window expires unmet, voids the tranche, and notifies both parties", () => {
    // Window is 45 days from 2026-06-01 -> deadline 2026-07-16T00:00Z
    const r = run([makeEntry("2026-06-01", V(2, 0, 0))], "2026-07-16T00:00:00Z");
    const first = r.milestones[0];
    expect(first.status).toBe("missed");
    expect(first.missedAt).toBe("2026-07-16T00:00:00.000Z");
    expect(r.voided).toHaveLength(1);
    expect(r.voided[0]).toMatchObject({ milestoneId: "ms_a", tranchePct: 2, reason: "missed" });
    expect(r.vested).toHaveLength(0);
    const notifiedUsers = r.notifications.map((n) => n.userId).sort();
    expect(notifiedUsers).toEqual(["usr_builder", "usr_cp"]);
  });

  it("does not miss one second before the deadline", () => {
    const r = run([], "2026-07-15T23:59:59Z");
    expect(r.milestones[0].status).toBe("open");
    expect(r.voided).toHaveLength(0);
  });

  it("opens the next milestone after a miss so the schedule keeps moving", () => {
    const r = run([], "2026-07-16T00:00:00Z");
    expect(r.milestones[1].status).toBe("open");
    expect(r.milestones[1].openedAt).toBe("2026-07-16T00:00:00.000Z");
  });

  it("a target hit by a ledger week that starts after the deadline does not clear the milestone", () => {
    const r = run([makeEntry("2026-07-20", V(3, 0, 0))], "2026-07-21T00:00:00Z");
    expect(r.milestones[0].status).toBe("missed");
    expect(r.vested).toHaveLength(0);
  });

  it("a target hit inside the window still clears even if evaluated after the deadline", () => {
    const r = run([makeEntry("2026-07-13", V(3, 0, 0))], "2026-08-01T00:00:00Z");
    expect(r.milestones[0].status).toBe("cleared");
    expect(r.vested).toHaveLength(1);
  });

  it("reports the proving run outcome so the service can convert or lapse the pairing", () => {
    expect(run([makeEntry("2026-06-01", V(3, 0, 0))], "2026-06-05T00:00:00Z").provingRunOutcome).toBe(
      "cleared",
    );
    expect(run([], "2026-07-16T00:00:00Z").provingRunOutcome).toBe("missed");
    expect(run([], "2026-06-05T00:00:00Z").provingRunOutcome).toBeNull();
  });
});

describe("vesting totals", () => {
  it("sums vested tranches and total on offer", () => {
    const ms = kypMilestones();
    expect(totalOnOffer(ms)).toBe(12);
    expect(
      vestedTotal([
        { id: "v1", pairingId: "p", milestoneId: "ms_a", tranchePct: 2, vestedAt: START, ledgerEntryId: "x" },
        { id: "v2", pairingId: "p", milestoneId: "ms_b", tranchePct: 2, vestedAt: START, ledgerEntryId: "y" },
      ]),
    ).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  PAIRING_EVENTS,
  canTransition,
  isTerminalState,
  transitionPairing,
} from "../pairing";
import { PAIRING_STATES, type PairingState } from "../types";
import { d, makePairing } from "./fixtures";

const NOW = d("2026-07-01T00:00:00.000Z");

/**
 * The complete legal transition table from the spec:
 *   proving_run -> active -> released
 *   proving_run -> lapsed
 *   active -> completed
 */
const LEGAL: Array<[PairingState, (typeof PAIRING_EVENTS)[number], PairingState]> = [
  ["proving_run", "convert", "active"],
  ["proving_run", "lapse", "lapsed"],
  ["active", "release", "released"],
  ["cofounder", "release", "released"],
  ["active", "complete", "completed"],
];

describe("pairing state machine", () => {
  describe("legal transitions", () => {
    it.each(LEGAL)("%s --%s--> %s", (from, event, to) => {
      const before = makePairing({ state: from });
      const after = transitionPairing(before, event, { now: NOW, actorId: "usr_builder" });
      expect(after.state).toBe(to);
      expect(canTransition(from, event)).toBe(true);
    });
  });

  describe("illegal transitions", () => {
    const legalSet = new Set(LEGAL.map(([f, e]) => `${f}:${e}`));
    const illegal = PAIRING_STATES.flatMap((from) =>
      PAIRING_EVENTS.filter((e) => !legalSet.has(`${from}:${e}`)).map((e) => [from, e] as const),
    );

    it("covers every state/event pair not in the legal table", () => {
      expect(illegal.length).toBe(PAIRING_STATES.length * PAIRING_EVENTS.length - LEGAL.length);
    });

    it.each(illegal)("%s --%s--> throws IllegalTransitionError", (from, event) => {
      const pairing = makePairing({ state: from });
      expect(canTransition(from, event)).toBe(false);
      expect(() => transitionPairing(pairing, event, { now: NOW })).toThrow(IllegalTransitionError);
    });
  });

  it("never mutates the input pairing", () => {
    const before = makePairing({ state: "proving_run" });
    const frozen = Object.freeze({ ...before });
    const after = transitionPairing(frozen, "convert", { now: NOW });
    expect(frozen.state).toBe("proving_run");
    expect(after).not.toBe(frozen);
  });

  it("records convertedAt on convert", () => {
    const after = transitionPairing(makePairing(), "convert", { now: NOW });
    expect(after.convertedAt).toBe(NOW.toISOString());
    expect(after.endedAt).toBeNull();
  });

  it("records endedAt, endedBy and reason on release", () => {
    const after = transitionPairing(makePairing({ state: "active" }), "release", {
      now: NOW,
      actorId: "usr_cp",
      reason: "Moving abroad",
    });
    expect(after.state).toBe("released");
    expect(after.endedAt).toBe(NOW.toISOString());
    expect(after.endedBy).toBe("usr_cp");
    expect(after.endReason).toBe("Moving abroad");
  });

  it("records endedAt on lapse and complete", () => {
    expect(transitionPairing(makePairing(), "lapse", { now: NOW }).endedAt).toBe(NOW.toISOString());
    expect(
      transitionPairing(makePairing({ state: "active" }), "complete", { now: NOW }).endedAt,
    ).toBe(NOW.toISOString());
  });

  it("marks released, lapsed and completed as terminal", () => {
    expect(isTerminalState("released")).toBe(true);
    expect(isTerminalState("lapsed")).toBe(true);
    expect(isTerminalState("completed")).toBe(true);
    expect(isTerminalState("proving_run")).toBe(false);
    expect(isTerminalState("active")).toBe(false);
  });
});

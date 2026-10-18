import type { Pairing, PairingState } from "./types";

/**
 * Pairing state machine.
 *
 *   proving_run -> active -> released
 *   proving_run -> lapsed
 *   active -> completed
 *
 * Clients never set state directly. They raise an event and the service
 * layer calls `transitionPairing`, which either returns a new Pairing or
 * throws `IllegalTransitionError`.
 */

export const PAIRING_EVENTS = ["convert", "release", "lapse", "complete"] as const;
export type PairingEvent = (typeof PAIRING_EVENTS)[number];

const TRANSITIONS: Readonly<Record<PairingState, Readonly<Partial<Record<PairingEvent, PairingState>>>>> = {
  offered: {}, declined: {}, cofounder: { release: "released" },
  proving_run: { convert: "active", lapse: "lapsed" },
  active: { release: "released", complete: "completed" },
  released: {},
  lapsed: {},
  completed: {},
};

const TERMINAL_STATES: ReadonlySet<PairingState> = new Set(["released", "lapsed", "completed", "declined"]);

export const DAY_MS = 24 * 60 * 60 * 1000;

export class IllegalTransitionError extends Error {
  readonly from: PairingState;
  readonly event: PairingEvent;

  constructor(from: PairingState, event: PairingEvent) {
    super(`Cannot apply "${event}" to a pairing in state "${from}"`);
    this.name = "IllegalTransitionError";
    this.from = from;
    this.event = event;
  }
}

export interface TransitionContext {
  now: Date;
  actorId?: string;
  reason?: string;
}

export function canTransition(from: PairingState, event: PairingEvent): boolean {
  return TRANSITIONS[from][event] !== undefined;
}

export function nextState(from: PairingState, event: PairingEvent): PairingState | null {
  return TRANSITIONS[from][event] ?? null;
}

export function isTerminalState(state: PairingState): boolean {
  return TERMINAL_STATES.has(state);
}

export function availableEvents(state: PairingState): PairingEvent[] {
  return PAIRING_EVENTS.filter((e) => canTransition(state, e));
}

/** Returns a new Pairing. Never mutates the input. */
export function transitionPairing(
  pairing: Pairing,
  event: PairingEvent,
  ctx: TransitionContext,
): Pairing {
  const to = nextState(pairing.state, event);
  if (to === null) {
    throw new IllegalTransitionError(pairing.state, event);
  }
  const at = ctx.now.toISOString();

  if (event === "convert") {
    return { ...pairing, state: to, convertedAt: at };
  }

  return {
    ...pairing,
    state: to,
    endedAt: at,
    endedBy: ctx.actorId ?? null,
    endReason: ctx.reason ?? null,
  };
}

/** Whole days from the pairing start to now, or to when it ended. */
export function pairingDayCount(pairing: Pairing, now: Date): number {
  const from = new Date(pairing.startedAt).getTime();
  const to = pairing.endedAt ? new Date(pairing.endedAt).getTime() : now.getTime();
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

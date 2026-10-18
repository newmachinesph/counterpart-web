import { api } from '@/lib/api/client';
import { getStore } from '@/lib/data/store';
import type { LedgerEntry, Milestone, Pairing, TermsTemplate, User, Venture, VestingEntry, VoidedTranche, } from "@/lib/domain/types";
import { ForbiddenError, NotFoundError } from './ids';
import { createReadModel } from './read-model';
export interface MetricCardData {
  label: string;
  value: number;
  target: number | null;
  unit: "php" | "count";
}

export interface DashboardWeek {
  weekStarting: string;
  entry: LedgerEntry | null;
  closed: boolean;
}

export interface PairingDashboard {
  pairing: Pairing;
  venture: Venture;
  builder: User;
  counterpart: User;
  dayCount: number;
  provingRunDaysLeft: number | null;
  milestones: Array<Milestone & { deadline: string | null }>;
  openMilestone: Milestone | null;
  cards: {
    current: MetricCardData;
    revenue: MetricCardData;
    equity: { vestedPct: number; onOfferPct: number };
  };
  weeks: DashboardWeek[];
  lastEightWeeks: DashboardWeek[];
  latestEntry: LedgerEntry | null;
  thisWeek: string;
  thisWeekEntry: LedgerEntry | null;
  vesting: VestingEntry[];
  voided: VoidedTranche[];
  terms: TermsTemplate | null;
  users: Map<string, User>;
}
export async function getPairing(id: string): Promise<Pairing | null> { return createReadModel(await getStore()).getPairing(id); }
export function canViewPairing(user: User, pairing: Pairing): boolean {
  return (
    user.roles.includes("admin") ||
    pairing.builderId === user.id ||
    pairing.counterpartId === user.id
  );
}
export function assertCanView(user: User, pairing: Pairing): void {
  if (!canViewPairing(user, pairing)) throw new ForbiddenError("This pairing is not yours");
}
export function assertIsParty(user: User, pairing: Pairing): void {
  const party = user.roles.includes("admin") || pairing.builderId === user.id || pairing.counterpartId === user.id;
  if (!party) throw new ForbiddenError("Only the builder or the Counterpart can do this");
}
export async function listPairingsForUser(user: User): Promise<Pairing[]> { return createReadModel(await getStore()).listPairingsForUser(user); }
export async function getDashboard(user: User, pairingId: string, now = new Date()): Promise<PairingDashboard> { return createReadModel(await getStore()).getDashboard(user, pairingId, now); }

export async function syncPairing(id: string, _now = new Date()): Promise<Pairing> { void _now; const p = createReadModel(await getStore()).getPairing(id); if (!p) throw new NotFoundError('Pairing'); return p; }
export async function endPairing(_user: User, id: string, reason: string): Promise<Pairing> { return api('/pairings/'+encodeURIComponent(id)+'/end', {reason}); }
export async function requestReview(_user: User, id: string, message: string): Promise<void> { return api('/pairings/'+encodeURIComponent(id)+'/review-request', {message}); }

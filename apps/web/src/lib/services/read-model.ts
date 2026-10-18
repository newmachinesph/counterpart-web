import type { Store } from '@/lib/data/store';
import { aggregateMetric,ledgerWeeks,sortByWeek,weekStartOf } from '@/lib/domain/ledger';
import { milestoneDeadline,totalOnOffer,vestedTotal } from '@/lib/domain/milestones';
import { sortOpenings } from '@/lib/domain/openings';
import { DAY_MS,pairingDayCount } from '@/lib/domain/pairing';
import type { Application,JobApplication,Milestone,Notification,Opening,Pairing,User,Venture } from '@/lib/domain/types';
import type { QueueItem } from './applications';
import { ForbiddenError,NotFoundError } from './ids';
import type { JobQueueItem,OpeningCard,OpeningFilters } from './openings';
import type { PairingDashboard } from './pairings';
import type { BenchCard,BenchFilters,PublishCheck } from './ventures';

/** Pure presentation selectors over a request-scoped API snapshot. */
export function createReadModel(store: Store) {
function hasLivePairing(ventureId: string): boolean { return store.liveVentureIds.includes(ventureId); }

function isOnBench(venture: Venture): boolean {
  return ["published", "development"].includes(venture.status) && !hasLivePairing(venture.id);
}

function listBench(filters: BenchFilters = {}): BenchCard[] {

  return store.ventures
    .filter(v => isOnBench(v))
    .filter(v => v.status !== "development" || [filters.equityMin, filters.equityMax, filters.hoursMax].every(value => value == null))
    .filter((v) => !filters.category || v.category === filters.category)
    .filter((v) => !filters.stage || v.stage === filters.stage)
    .filter((v) => filters.equityMin == null || v.equityMaxPct >= filters.equityMin)
    .filter((v) => filters.equityMax == null || v.equityMinPct <= filters.equityMax)
    .filter((v) => filters.hoursMax == null || v.hoursPerWeek <= filters.hoursMax)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((venture) => ({
      venture,
      applicantCount: store.applicantCounts[venture.id] ?? 0,
      totalOnOfferPct: milestonesFor(venture.id).reduce((s, m) => s + m.tranchePct, 0),
    }));
}

function getVentureBySlug(slug: string): Venture | null {
  return store.ventures.find((v) => v.slug === slug) ?? null;
}

function getVentureById(id: string): Venture | null {
  return store.ventures.find((v) => v.id === id) ?? null;
}

function milestonesFor(ventureId: string): Milestone[] {
  return store
    .milestones.filter((m) => m.ventureId === ventureId)
    .sort((a, b) => a.sequence - b.sequence);
}

function listVenturesForBuilder(user: User): Venture[] {
  const all = store.ventures;
  const mine = user.roles.includes("admin") ? all : all.filter((v) => v.builderId === user.id);
  return [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function canManageVenture(user: User, venture: Venture): boolean {
  return user.roles.includes("admin") || venture.builderId === user.id;
}

function assertCanManage(user: User, venture: Venture): void {
  if (!canManageVenture(user, venture)) {
    throw new ForbiddenError("Only the builder or an admin can manage this venture");
  }
}

function checkPublishable(venture: Venture): PublishCheck {
  const problems: string[] = [];
  if (!isHttpUrl(venture.productUrl)) {
    problems.push("Product URL must be a valid http(s) URL");
  } else if (!venture.productUrlVerifiedAt) {
    problems.push("Product URL has not been verified as reachable");
  }
  if (venture.screenshots.length === 0) {
    problems.push("At least one screenshot is required");
  }
  if (milestonesFor(venture.id).length === 0) {
    problems.push("At least one milestone is required");
  }
  return { ok: problems.length === 0, problems };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function findApplication(ventureId: string, applicantId: string): Application | null {
  return (
    store.applications.find(
      (a) => a.ventureId === ventureId && a.applicantId === applicantId,
    ) ?? null
  );
}

function listApplicationsForVenture(user: User, venture: Venture): QueueItem[] {
  assertCanManage(user, venture);

  return store.applications
    .filter((a) => a.ventureId === venture.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .flatMap((application) => {
      const applicant = store.users.find((u) => u.id === application.applicantId);
      return applicant ? [{ application, applicant }] : [];
    });
}

function listApplicationsForUser(
  user: User,
): Array<{ application: Application; venture: Venture }> {

  return store.applications
    .filter((a) => a.applicantId === user.id)
    .flatMap((application) => {
      const venture = store.ventures.find((v) => v.id === application.ventureId);
      return venture ? [{ application, venture }] : [];
    });
}

function getPairing(id: string): Pairing | null {
  return store.pairings.find((p) => p.id === id) ?? null;
}

function canViewPairing(user: User, pairing: Pairing): boolean {
  return (
    user.roles.includes("admin") ||
    pairing.builderId === user.id ||
    pairing.counterpartId === user.id
  );
}

function assertCanView(user: User, pairing: Pairing): void {
  if (!canViewPairing(user, pairing)) throw new ForbiddenError("This pairing is not yours");
}

function assertIsParty(user: User, pairing: Pairing): void {
  const party = user.roles.includes("admin") || pairing.builderId === user.id || pairing.counterpartId === user.id;
  if (!party) throw new ForbiddenError("Only the builder or the Counterpart can do this");
}

function listPairingsForUser(user: User): Pairing[] {
  const all = store.pairings;
  const seesAll = user.roles.includes("admin");
  const mine = seesAll ? all : all.filter((p) => canViewPairing(user, p));
  return [...mine].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function getDashboard(user: User, pairingId: string, now = new Date()): PairingDashboard {
  const synced = getPairing(pairingId);
  if (!synced) throw new NotFoundError("Pairing");
  assertCanView(user, synced);

  const venture = store.ventures.find((v) => v.id === synced.ventureId);
  const builder = store.users.find((u) => u.id === synced.builderId);
  const counterpart = store.users.find((u) => u.id === synced.counterpartId);
  if (!venture || !builder || !counterpart) throw new NotFoundError("Pairing");

  const milestones = (synced.milestoneSnapshot?.length ? synced.milestoneSnapshot : store.milestones.filter((m) => m.ventureId === venture.id))
    .sort((a, b) => a.sequence - b.sequence)
    .map((m) => ({ ...m, deadline: milestoneDeadline(m)?.toISOString() ?? null }));
  const openMilestone = milestones.find((m) => m.status === "open") ?? null;
  const entries = sortByWeek(store.ledgerEntries.filter((e) => e.pairingId === synced.id));
  const vesting = store.vesting.filter((v) => v.pairingId === synced.id);
  const voided = store.voided.filter((v) => v.pairingId === synced.id);

  const metrics = synced.agreement?.metrics ?? venture.metrics;
  const revenueMetric =
    metrics.find((m) => m.key === "revenue_php") ??
    metrics.find((m) => m.unit === "php");
  const currentMetric = openMilestone
    ? metrics.find((m) => m.key === openMilestone.metricKey)
    : metrics[0];

  const weeks = ledgerWeeks(entries, weekStartOf(new Date(synced.startedAt)), now);
  const thisWeek = weekStartOf(now);
  const provingRunEnd = new Date(synced.startedAt).getTime() + synced.provingRunDays * DAY_MS;

  return {
    pairing: synced,
    venture,
    builder,
    counterpart,
    dayCount: pairingDayCount(synced, now),
    provingRunDaysLeft:
      synced.state === "proving_run"
        ? Math.max(0, Math.ceil((provingRunEnd - now.getTime()) / DAY_MS))
        : null,
    milestones,
    openMilestone,
    cards: {
      current: {
        label: currentMetric?.label ?? "Current",
        value: currentMetric ? aggregateMetric(entries, currentMetric) : 0,
        target: openMilestone?.targetValue ?? null,
        unit: currentMetric?.unit ?? "count",
      },
      revenue: {
        label: "Cumulative revenue",
        value: revenueMetric ? aggregateMetric(entries, revenueMetric) : 0,
        target: null,
        unit: "php",
      },
      equity: { vestedPct: vestedTotal(vesting), onOfferPct: totalOnOffer(milestones) },
    },
    weeks,
    lastEightWeeks: weeks.slice(-8),
    latestEntry: entries.length ? entries[entries.length - 1] : null,
    thisWeek,
    thisWeekEntry: entries.find((e) => e.weekStarting === thisWeek) ?? null,
    vesting,
    voided,
    terms: synced.agreement?.template ?? store.termsTemplates.find((t) => t.id === venture.termsTemplateId) ?? null,
    users: new Map(store.users.map((u) => [u.id, u])),
  };
}

function ledgerRevenueFor(ventureId: string | null, _now = new Date()): number { void _now; return ventureId ? (store.ledgerRevenue[ventureId] ?? 0) : 0; }

function canPostForVenture(user: User, venture: Venture): boolean {
  if (canManageVenture(user, venture)) return true;
  return store.pairings.some(
    (p) => p.ventureId === venture.id && p.counterpartId === user.id && (["proving_run", "active", "cofounder"].includes(p.state)),
  );
}

function canManageOpening(user: User, opening: Opening): boolean {
  if (opening.ventureId === null) return user.roles.includes("admin");
  const venture = getVentureById(opening.ventureId);
  return venture ? canPostForVenture(user, venture) : user.roles.includes("admin");
}

function postableVentures(user: User): Venture[] {
  return store.ventures.filter((v) => v.status === "published" && canPostForVenture(user, v));
}

function isPublic(o: Opening): boolean {
  if (o.ventureId === null) return true;
  return getVentureById(o.ventureId)?.status === "published";
}

function toCard(opening: Opening, now = new Date()): OpeningCard {

  return {
    opening,
    venture: opening.ventureId ? (store.ventures.find((v) => v.id === opening.ventureId) ?? null) : null,
    applicantCount: store.jobApplicantCounts[opening.id] ?? 0,
    ledgerRevenuePhp: ledgerRevenueFor(opening.ventureId, now),
  };
}

function listOpenings(filters: OpeningFilters = {}, now = new Date()): OpeningCard[] {
  const open = store.openings.filter((o) => o.status === "open" && isPublic(o));
  return sortOpenings(open)
    .filter((o) => !filters.type || o.type === filters.type)
    .filter((o) => !filters.arrangement || o.arrangement === filters.arrangement)
    .filter((o) => !filters.ventureId || o.ventureId === filters.ventureId)
    .filter((o) => !filters.counterpartOnly || o.ventureId === null)
    .filter((o) => !filters.paidOnly || (o.salaryMinPhpMonthly ?? 0) > 0)
    .map((o) => toCard(o, now));
}

function getOpening(id: string): Opening | null {
  return store.openings.find((o) => o.id === id) ?? null;
}

function getOpeningCard(id: string, now = new Date()): OpeningCard | null {
  const o = getOpening(id);
  if (!o || !isPublic(o)) return null;
  return toCard(o, now);
}

function listOpeningsForVenture(ventureId: string): Opening[] {
  return sortOpenings(store.openings.filter((o) => o.ventureId === ventureId));
}

function listOpeningsIManage(user: User): OpeningCard[] {
  return sortOpenings(store.openings.filter((o) => canManageOpening(user, o))).map((o) => toCard(o));
}

function findJobApplication(openingId: string, applicantId: string): JobApplication | null {
  return store.jobApplications.find((a) => a.openingId === openingId && a.applicantId === applicantId) ?? null;
}

function listApplicantsForOpening(user: User, openingId: string): JobQueueItem[] {
  const opening = getOpening(openingId);
  if (!opening) throw new NotFoundError("Opening");
  if (!canManageOpening(user, opening)) throw new ForbiddenError("This role is not yours to manage");

  return store.jobApplications
    .filter((a) => a.openingId === openingId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .flatMap((application) => {
      const applicant = store.users.find((u) => u.id === application.applicantId);
      return applicant ? [{ application, applicant }] : [];
    });
}

function listJobApplicationsForUser(user: User): Array<{ application: JobApplication; opening: Opening }> {

  return store.jobApplications
    .filter((a) => a.applicantId === user.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .flatMap((application) => {
      const opening = store.openings.find((o) => o.id === application.openingId);
      return opening ? [{ application, opening }] : [];
    });
}

function listNotifications(userId: string): Notification[] {
  return store
    .notifications.filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function unreadCount(userId: string): number {
  return store.notifications.filter((n) => n.userId === userId && !n.readAt).length;
}

function listOutbox() {
  return [...store.outbox].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

return { hasLivePairing, isOnBench, listBench, getVentureBySlug, getVentureById, milestonesFor, listVenturesForBuilder, canManageVenture, assertCanManage, checkPublishable, isHttpUrl, slugify, findApplication, listApplicationsForVenture, listApplicationsForUser, getPairing, canViewPairing, assertCanView, assertIsParty, listPairingsForUser, getDashboard, ledgerRevenueFor, canPostForVenture, canManageOpening, postableVentures, isPublic, toCard, listOpenings, getOpening, getOpeningCard, listOpeningsForVenture, listOpeningsIManage, findJobApplication, listApplicantsForOpening, listJobApplicationsForUser, listNotifications, unreadCount, listOutbox };
}

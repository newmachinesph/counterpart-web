import { api } from '@/lib/api/client';
import { getStore } from '@/lib/data/store';
import type { Milestone, User, Venture, VentureCategory, VentureStage, } from "@/lib/domain/types";
import { ForbiddenError } from './ids';
import { createReadModel } from './read-model';
export interface BenchFilters {
  category?: VentureCategory | null;
  stage?: VentureStage | null;
  equityMin?: number | null;
  equityMax?: number | null;
  hoursMax?: number | null;
}

export interface BenchCard {
  venture: Venture;
  applicantCount: number;
  totalOnOfferPct: number;
}

export interface PublishCheck {
  ok: boolean;
  problems: string[];
}

export interface MilestoneInput {
  title: string;
  metricKey: string;
  metricLabel: string;
  unit: "php" | "count";
  aggregation: "sum" | "latest";
  targetValue: number;
  tranchePct: number;
  windowDays: number;
}

export interface VentureInput {
  commercialTerms: import("@/lib/domain/types").CommercialTerms;
  name: string;
  oneLiner: string;
  description: string;
  category: VentureCategory;
  stage: VentureStage;
  productUrl: string;
  screenshots: string[];
  logoUrl?: string | null;
  tractionSummary: string;
  equityMinPct: number;
  equityMaxPct: number;
  hoursPerWeek: number;
  builderHasDone: string[];
  counterpartWouldOwn: string[];
  vestingTerms: string;
  unitLabel: string;
  revenuePerUnitPhpMonthly: number;
  variableCostPerUnitPhpMonthly: number;
  monthlyContributionPhp: number;
  withinDays: number;
  internsWelcome: boolean;
  milestones: MilestoneInput[];
}
export async function hasLivePairing(ventureId: string): Promise<boolean> { return createReadModel(await getStore()).hasLivePairing(ventureId); }
export async function isOnBench(venture: Venture): Promise<boolean> { return createReadModel(await getStore()).isOnBench(venture); }
export async function listBench(filters: BenchFilters = {}): Promise<BenchCard[]> { return createReadModel(await getStore()).listBench(filters); }
export async function getVentureBySlug(slug: string): Promise<Venture | null> { return createReadModel(await getStore()).getVentureBySlug(slug); }
export async function getVentureById(id: string): Promise<Venture | null> { return createReadModel(await getStore()).getVentureById(id); }
export async function milestonesFor(ventureId: string): Promise<Milestone[]> { return createReadModel(await getStore()).milestonesFor(ventureId); }
export async function listVenturesForBuilder(user: User): Promise<Venture[]> { return createReadModel(await getStore()).listVenturesForBuilder(user); }
export function canManageVenture(user: User, venture: Venture): boolean {
  return user.roles.includes("admin") || venture.builderId === user.id;
}
export function assertCanManage(user: User, venture: Venture): void {
  if (!canManageVenture(user, venture)) {
    throw new ForbiddenError("Only the builder or an admin can manage this venture");
  }
}
export async function checkPublishable(venture: Venture): Promise<PublishCheck> { return createReadModel(await getStore()).checkPublishable(venture); }
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createVenture(_user: User, input: VentureInput): Promise<Venture> {
 const { unitLabel, revenuePerUnitPhpMonthly, variableCostPerUnitPhpMonthly, monthlyContributionPhp, withinDays, ...rest } = input;
 return api('/ventures', { ...rest, unitEconomics: { unitLabel, revenuePerUnitPhpMonthly, variableCostPerUnitPhpMonthly, note: '' }, profitabilityTarget: { monthlyContributionPhp, withinDays, excludes: ['Tech and infrastructure', 'Salaries', 'Legal and accounting'] } });
}
export async function publishVenture(_user: User, id: string): Promise<Venture> { return api('/ventures/'+encodeURIComponent(id)+'/publish', {}); }
export async function unpublishVenture(_user: User, id: string): Promise<Venture> { return api('/ventures/'+encodeURIComponent(id)+'/unpublish', {}); }

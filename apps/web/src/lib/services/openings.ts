import { api } from '@/lib/api/client';
import { getStore } from '@/lib/data/store';
import type { JobApplicationDraft, OpeningDraft } from '@/lib/domain/openings';
import type { JobApplication, Opening, OpeningType, User, Venture, WorkArrangement } from "@/lib/domain/types";
import { createReadModel } from './read-model';
export interface OpeningCard {
  opening: Opening;
  venture: Venture | null;
  applicantCount: number;
  ledgerRevenuePhp: number;
}

export interface OpeningFilters {
  type?: OpeningType | null;
  arrangement?: WorkArrangement | null;
  ventureId?: string | null;
  counterpartOnly?: boolean;
  paidOnly?: boolean;
}

export interface JobQueueItem {
  application: JobApplication;
  applicant: User;
}

export type JobReviewAction = "shortlist" | "decline" | "hire";
export async function ledgerRevenueFor(ventureId: string | null, now = new Date()): Promise<number> { return createReadModel(await getStore()).ledgerRevenueFor(ventureId, now); }
export async function canPostForVenture(user: User, venture: Venture): Promise<boolean> { return createReadModel(await getStore()).canPostForVenture(user, venture); }
export async function canManageOpening(user: User, opening: Opening): Promise<boolean> { return createReadModel(await getStore()).canManageOpening(user, opening); }
export async function postableVentures(user: User): Promise<Venture[]> { return createReadModel(await getStore()).postableVentures(user); }
export async function toCard(opening: Opening, now = new Date()): Promise<OpeningCard> { return createReadModel(await getStore()).toCard(opening, now); }
export async function listOpenings(filters: OpeningFilters = {}, now = new Date()): Promise<OpeningCard[]> { return createReadModel(await getStore()).listOpenings(filters, now); }
export async function getOpening(id: string): Promise<Opening | null> { return createReadModel(await getStore()).getOpening(id); }
export async function getOpeningCard(id: string, now = new Date()): Promise<OpeningCard | null> { return createReadModel(await getStore()).getOpeningCard(id, now); }
export async function listOpeningsForVenture(ventureId: string): Promise<Opening[]> { return createReadModel(await getStore()).listOpeningsForVenture(ventureId); }
export async function listOpeningsIManage(user: User): Promise<OpeningCard[]> { return createReadModel(await getStore()).listOpeningsIManage(user); }
export async function findJobApplication(openingId: string, applicantId: string): Promise<JobApplication | null> { return createReadModel(await getStore()).findJobApplication(openingId, applicantId); }
export async function listApplicantsForOpening(user: User, openingId: string): Promise<JobQueueItem[]> { return createReadModel(await getStore()).listApplicantsForOpening(user, openingId); }
export async function listJobApplicationsForUser(user: User): Promise<Array<{ application: JobApplication; opening: Opening }>> { return createReadModel(await getStore()).listJobApplicationsForUser(user); }

export async function createOpening(_user: User, draft: OpeningDraft): Promise<Opening> { return api('/jobs', draft); }
export async function setOpeningStatus(_user: User, id: string, status: Opening['status']): Promise<Opening> { return api('/jobs/'+encodeURIComponent(id)+'/status', {status}); }
export async function applyToOpening(_user: User, id: string, draft: JobApplicationDraft): Promise<JobApplication> { return api('/jobs/'+encodeURIComponent(id)+'/applications', draft); }
export async function reviewJobApplication(_user: User, id: string, action: JobReviewAction): Promise<JobApplication> { return api('/job-applications/'+encodeURIComponent(id)+'/review', {action}); }

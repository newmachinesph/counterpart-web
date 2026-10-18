import { api } from '@/lib/api/client';
import { getStore } from '@/lib/data/store';
import type { Application, Compensation, NumbersMoved, Track, User, Venture } from "@/lib/domain/types";
import { createReadModel } from './read-model';
export interface ApplicationInput {
  evidence: string;
  proofLinks: string[];
  numbersMoved: NumbersMoved[];
  hoursPerWeek: number;
  compensation: Compensation;
  track: Track;
  requestedEquityPct: number;
  templateId: string;
  commitments: string[];
  acknowledgesResourceClause: boolean;
  whyThisVenture: string;
}

export interface QueueItem {
  application: Application;
  applicant: User;
}

export type ReviewAction = "shortlist" | "decline" | "invite";
export const MIN_EVIDENCE_CHARS = 200;
export async function findApplication(ventureId: string, applicantId: string): Promise<Application | null> { return createReadModel(await getStore()).findApplication(ventureId, applicantId); }
export async function listApplicationsForVenture(user: User, venture: Venture): Promise<QueueItem[]> { return createReadModel(await getStore()).listApplicationsForVenture(user, venture); }
export async function listApplicationsForUser(user: User): Promise<Array<{ application: Application; venture: Venture }>> { return createReadModel(await getStore()).listApplicationsForUser(user); }

export async function submitApplication(_user: User, venture: Venture, input: ApplicationInput): Promise<Application> { return api('/ventures/'+encodeURIComponent(venture.slug)+'/applications', input); }
export async function reviewApplication(_user: User, id: string, action: ReviewAction): Promise<Application> { return api('/applications/'+encodeURIComponent(id)+'/review', {action}); }

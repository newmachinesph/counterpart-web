import { api, ApiError } from '@/lib/api/client';
import type { Application, JobApplication, LedgerEntry, Milestone, Notification, Opening, Pairing, TermsTemplate, User, Venture, VestingEntry, VoidedTranche, } from "@/lib/domain/types";
import { cache } from 'react';

/** Request-scoped, read-only data fetched from the authorized API. */

export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

export interface Store {
  liveVentureIds: string[];
  completedVentureIds?: string[];
  applicantCounts: Record<string, number>;
  jobApplicantCounts: Record<string, number>;
  ledgerRevenue: Record<string, number>;
  users: User[];
  ventures: Venture[];
  milestones: Milestone[];
  pairings: Pairing[];
  ledgerEntries: LedgerEntry[];
  vesting: VestingEntry[];
  voided: VoidedTranche[];
  applications: Application[];
  openings: Opening[];
  jobApplications: JobApplication[];
  termsTemplates: TermsTemplate[];
  notifications: Notification[];
  outbox: OutboxEmail[];
}

export const getStore = cache(async (): Promise<Store> => {
  try { return await api<Store>('/workspace'); } catch (error) {
    if (error instanceof ApiError && error.status === 401) return api<Store>('/workspace', undefined, true);
    throw error;
  }
});

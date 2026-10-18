import { api } from '@/lib/api/client';
import type { LedgerEntry, User } from "@/lib/domain/types";
export interface LogWeekInput {
  weekStarting: string;
  values: Record<string, number>;
  note: string;
  evidenceLinks: string[];
}

export async function logWeek(_user: User, id: string, input: LogWeekInput): Promise<LedgerEntry> { return api('/pairings/'+encodeURIComponent(id)+'/ledger', input); }
export async function commentOnEntry(_user: User, id: string, body: string): Promise<void> { return api('/ledger/'+encodeURIComponent(id)+'/comments', {body}); }

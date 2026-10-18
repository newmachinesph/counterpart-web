export const CASE_CATEGORIES = { support: "Support", listing: "Listing report", account: "Account request", dispute: "Dispute" } as const;
export const CASE_STATUSES = { open: "Open", in_review: "In review", resolved: "Resolved" } as const;
export type CaseCategory = keyof typeof CASE_CATEGORIES;
export type CaseStatus = keyof typeof CASE_STATUSES;
export interface SupportRequest {
  id: string; category: CaseCategory; subject: string; message: string; status: CaseStatus;
  resolution: string | null; createdAt: string; resolvedAt: string | null; pairingId: string | null;
}
export interface OperationsCase extends SupportRequest {
  version: number; assignedTo: string | null; ownerName: string | null;
  reporter: { id: string; name: string; email: string };
  venture: { id: string; name: string; slug: string; status: string } | null;
  events?: Array<{ action: string; actorName: string; ownerName?: string | null; at: string; note: string; previousStatus?: string; newStatus?: string }>;
}
export interface OperationsOverview {
  openCases: number; unassignedCases: number; olderCases: number; myCases: number; emailFailures: number;
  categories: Record<CaseCategory, number>; admins: Array<{ id: string; name: string }>;
}
export interface CasePage<T = OperationsCase> { items: T[]; total: number; offset: number; limit: number }
export interface OperationsFormState { error?: string; success?: string }

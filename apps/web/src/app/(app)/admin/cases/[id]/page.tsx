import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { CASE_CATEGORIES, CASE_STATUSES, type OperationsCase, type OperationsOverview } from "@/lib/operations";
import { PageHeader, Pill, Notice } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { CaseActions } from "./case-actions";

export const metadata: Metadata = { title: "Review case" };
export const dynamic = "force-dynamic";
const labels: Record<string, string> = { assign: "Owner updated", start: "Review started", note: "Internal note", resolved: "Resolution recorded", reopen: "Case reopened", hide_listing: "Listing hidden", restore_listing: "Listing restored" };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin", `/admin/cases/${id}`);
  let row: OperationsCase;
  try { row = await api<OperationsCase>(`/admin/cases/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  const overview = await api<OperationsOverview>("/admin/overview");
  return <div>
    <Link href="/admin" className="mb-6 inline-block text-sm text-muted underline">Back to operations</Link>
    <PageHeader title={row.subject} description={`${CASE_CATEGORIES[row.category]} · ${row.id}`} aside={<Pill tone={row.status === "resolved" ? "green" : "blue"}>{CASE_STATUSES[row.status]}</Pill>} />
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-line p-5 sm:p-6"><h2 className="font-medium">Request from {row.reporter.name}</h2><p className="mt-1 break-all text-sm text-muted">{row.reporter.email} · {formatDate(row.createdAt)}</p><p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed">{row.message}</p>
          {row.venture && <Link className="mt-4 block text-sm underline" href={`/bench/${row.venture.slug}`}>View {row.venture.name}</Link>}
          {row.pairingId && <Link className="mt-3 block text-sm underline" href={`/pairings/${row.pairingId}/compensation`}>Review engagement evidence and compensation</Link>}
        </section>
        {row.category === "dispute" && <Notice>Recording a case outcome does not change a compensation claim or record a payment. Review the engagement to reconcile disputed claims separately.</Notice>}
        {row.resolution && <section className="rounded-2xl border border-green/30 bg-green-bg p-5"><h2 className="font-medium text-green">Recorded outcome</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.resolution}</p></section>}
        <section><h2 className="display mb-5 text-3xl">Case history</h2><ol className="ml-2 border-l border-line pl-5 space-y-6">{row.events?.toReversed().map((event, index) => <li key={index} className="relative"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand" /><p className="text-sm font-medium">{labels[event.action] ?? event.action}</p><p className="mt-1 text-xs text-muted">{event.actorName} · {formatDate(event.at)}{event.action === "assign" ? ` · ${event.ownerName ?? "Unassigned"}` : ""}</p>{event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{event.note}</p>}</li>)}<li className="text-sm text-muted">Case opened · {formatDate(row.createdAt)}</li></ol></section>
      </div>
      <section className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6"><h2 className="display mb-5 text-3xl">Take the next step.</h2><CaseActions row={row} admins={overview.admins} /></section>
    </div>
  </div>;
}

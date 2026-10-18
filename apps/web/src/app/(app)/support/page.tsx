import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/session";
import { PageHeader, Notice, Empty, Pill } from "@/components/ui";
import { CASE_STATUSES, type CasePage, type SupportRequest } from "@/lib/operations";
import { formatDate } from "@/lib/format";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const category = typeof q.category === "string" && ["support", "listing", "account"].includes(q.category) ? q.category : "support";
  const ventureSlug = typeof q.venture === "string" ? q.venture.slice(0, 80) : "";
  const next = `/support?${new URLSearchParams({ category, venture: ventureSlug })}`;
  await requireUser(next);
  const offset = typeof q.offset === "string" && /^\d{1,8}$/.test(q.offset) ? Number(q.offset) : 0;
  const requests = await api<CasePage<SupportRequest>>(`/support/requests?offset=${offset}`);
  return <>
    <PageHeader title="How can we help?" description="Ask for support, report a listing, or request help with your account. Track the response here." />
    {q.sent && requests.items.some(row => row.id === q.sent) && <div className="mb-6"><Notice tone="green">Your request was received. Its status and outcome will appear below.</Notice></div>}
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <section className="rounded-2xl border border-line p-5 sm:p-6"><h2 className="display mb-5 text-3xl">Send a request</h2><RequestForm initialCategory={category} ventureSlug={ventureSlug} /><p className="mt-5 border-t border-line pt-5 text-sm text-muted">For an engagement dispute, use Request review on your <Link href="/pairings" className="underline">Pairings page</Link> so both parties and the relevant agreement are connected.</p></section>
      <section className="min-w-0"><h2 className="display mb-5 text-3xl">Your requests</h2>{requests.items.length ? <ul className="space-y-4">{requests.items.map(row => <li key={row.id} className="rounded-2xl border border-line p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="break-words font-medium">{row.subject}</h3><Pill tone={row.status === "resolved" ? "green" : "blue"}>{CASE_STATUSES[row.status]}</Pill></div><p className="mt-2 text-xs text-muted">{row.id} · {formatDate(row.createdAt)}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{row.message}</p>{row.resolution && <div className="mt-4 border-t border-line pt-4"><p className="text-sm font-medium">Outcome</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.resolution}</p></div>}</li>)}</ul> : <Empty>You have no support requests yet.</Empty>}
        <nav aria-label="Request pages" className="mt-4 flex justify-between text-sm">{offset > 0 ? <Link className="underline" href={`/support?offset=${Math.max(0, offset - requests.limit)}`}>Previous</Link> : <span />}{offset + requests.limit < requests.total && <Link className="underline" href={`/support?offset=${offset + requests.limit}`}>Next</Link>}</nav>
      </section>
    </div>
  </>;
}

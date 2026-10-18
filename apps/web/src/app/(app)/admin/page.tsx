import Link from "next/link";
import type { Metadata } from "next";
import { api } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { CASE_CATEGORIES, CASE_STATUSES, type CasePage, type OperationsOverview } from "@/lib/operations";
import { Button, Empty, INPUT_CLASS, LinkButton, PageHeader, Pill } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin operations" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("admin", "/admin");
  const q = await searchParams;
  const value = (key: string, allowed: string[], fallback: string) => typeof q[key] === "string" && allowed.includes(q[key]) ? q[key] : fallback;
  const status = value("status", ["active", "open", "in_review", "resolved", "all"], "active");
  const category = value("category", ["all", ...Object.keys(CASE_CATEGORIES)], "all");
  const owner = value("owner", ["all", "mine", "unassigned"], "all");
  const search = typeof q.q === "string" ? q.q.slice(0, 120) : "";
  const offset = typeof q.offset === "string" && /^\d{1,8}$/.test(q.offset) ? Number(q.offset) : 0;
  const filters = new URLSearchParams({ status, category, owner, q: search, offset: String(offset) });
  const [overview, cases] = await Promise.all([
    api<OperationsOverview>("/admin/overview"), api<CasePage>(`/admin/cases?${filters}`),
  ]);
  const pageLink = (at: number) => { const params = new URLSearchParams(filters); params.set("offset", String(at)); return `/admin?${params}`; };
  return <div className="space-y-8">
    <PageHeader title="Keep things moving." description="A shared desk for the people, listings, and agreements that need attention." aside={<LinkButton href="/admin?owner=mine" variant="secondary">My cases ({overview.myCases})</LinkButton>} />
    <section aria-label="Operations summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      {[
        ["Active cases", overview.openCases, "/admin", "Open or under review"],
        ["Need an owner", overview.unassignedCases, "/admin?owner=unassigned", "Assign the next step"],
        ["Waiting 3+ days", overview.olderCases, "/admin", "Oldest requests appear first"],
        ["Email issues", overview.emailFailures, "/admin/email-queue", "Inspect delivery attempts"],
      ].map(([label, count, href, hint]) => <Link key={label} href={String(href)} className="bg-bg p-5 transition-colors hover:bg-surface sm:p-6">
        <p className="text-sm text-muted">{label}</p><p className="mt-3 text-4xl tracking-tight tnum text-brand">{count}</p><p className="mt-3 text-xs text-muted">{hint}</p>
      </Link>)}
    </section>
    <section aria-labelledby="queue-heading">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3"><h2 id="queue-heading" className="display text-3xl">The work queue</h2><p className="text-sm text-muted">{cases.total} matching {cases.total === 1 ? "case" : "cases"}</p></div>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Active cases by category">
        {Object.entries(CASE_CATEGORIES).map(([key, label]) => <Link key={key} href={`/admin?category=${key}`} className={`rounded-full border px-3 py-1.5 text-sm ${category === key ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-surface"}`}>{label} <span className="ml-2 tnum">{overview.categories[key as keyof typeof CASE_CATEGORIES]}</span></Link>)}
      </div>
      <form className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <input type="hidden" name="category" value={category} />
        <label className="text-xs text-muted">Subject or case ID<input name="q" defaultValue={search} maxLength={120} placeholder="Search cases" className={`${INPUT_CLASS} mt-1`} /></label>
        <label className="text-xs text-muted">Status<select name="status" defaultValue={status} className={`${INPUT_CLASS} mt-1`}><option value="active">Active cases</option><option value="all">All statuses</option>{Object.entries(CASE_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-xs text-muted">Owner<select name="owner" defaultValue={owner} className={`${INPUT_CLASS} mt-1`}><option value="all">Everyone</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select></label>
        <div className="flex items-end gap-3"><Button variant="secondary">Filter</Button><Link className="pb-3 text-sm underline" href="/admin">Reset</Link></div>
      </form>
      {cases.items.length ? <div className="overflow-hidden rounded-2xl border border-line">
        <div className="hidden grid-cols-[minmax(0,3fr)_1fr_1fr] gap-5 border-b border-line bg-surface px-5 py-3 text-xs text-muted md:grid"><span>Case / requester</span><span>Owner / status</span><span>Received</span></div>
        <ul className="divide-y divide-line">{cases.items.map(row => <li key={row.id}><Link href={`/admin/cases/${row.id}`} className="grid gap-4 p-5 hover:bg-surface md:grid-cols-[minmax(0,3fr)_1fr_1fr]">
          <div className="min-w-0"><p className="mb-2 text-xs text-brand">{CASE_CATEGORIES[row.category]}{row.venture ? ` · ${row.venture.name}` : ""}</p><h3 className="break-words font-medium">{row.subject}</h3><p className="mt-1 text-sm text-muted">{row.reporter.name}</p><p className="mt-2 text-xs text-muted">{row.id}</p></div>
          <div><Pill tone={row.status === "resolved" ? "green" : row.status === "in_review" ? "blue" : "neutral"}>{CASE_STATUSES[row.status]}</Pill><p className={`mt-2 text-sm ${row.ownerName ? "text-muted" : "text-brand"}`}>{row.ownerName ?? "Unassigned"}</p></div>
          <p className="text-sm text-muted">{formatDate(row.createdAt)}</p>
        </Link></li>)}</ul>
      </div> : <Empty>No cases match these filters. New support requests and engagement reviews will appear here.</Empty>}
      <nav aria-label="Case pages" className="mt-4 flex items-center justify-between text-sm">
        {offset > 0 ? <Link className="underline" href={pageLink(Math.max(0, offset - cases.limit))}>Previous</Link> : <span />}
        {offset + cases.limit < cases.total && <Link className="underline" href={pageLink(offset + cases.limit)}>Next</Link>}
      </nav>
    </section>
  </div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, hasRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/store";
import { Notice, LinkButton, Pill } from "@/components/ui";
import { Panel, Inbox, STATE_TONE } from "@/components/dashboard";
import { PAIRING_STATE_LABELS, formatDate } from "@/lib/format";
import { userInitials } from "@/lib/workspace-navigation";

export const metadata: Metadata = { title: "Your dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const store = await getStore();
  const pairs = store.pairings;
  const builder = hasRole(user, "builder");
  const admin = user.roles.includes("admin");
  const active = pairs.filter(p => ["proving_run", "active", "cofounder"].includes(p.state));
  const offers = pairs.filter(p => p.state === "offered");
  const notifications = store.notifications.filter(n => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const stats = [
    { label: "Active engagements", value: active.length, href: "/pairings", hint: "Partnerships in progress" },
    { label: "Open offers", value: offers.length, href: "/pairings", hint: "Awaiting acceptance" },
    { label: "Venture applications", value: store.applications.length, href: "#venture-applications", hint: builder ? "Received and submitted" : "Your venture applications" },
    { label: "Job applications", value: store.jobApplications.length, href: "#job-applications", hint: "Your hiring activity" },
  ].filter(stat => !stat.href.startsWith("#") || stat.value > 0);
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-brand">Your workspace</p><h1 className="display text-4xl sm:text-5xl break-words">Welcome back, {user.name.split(" ")[0]}.</h1><p className="mt-3 text-muted">A clear view of your partnerships and what comes next.</p></div>
      <LinkButton href={builder ? "/ventures" : "/bench"}>{builder ? "Manage ventures" : "Find your next venture"}<span aria-hidden="true" className="ml-3">&rarr;</span></LinkButton>
    </div>
    {!user.emailVerifiedAt && <Notice>Verify your email to make or accept offers. <Link href="/settings/verification" className="underline">Verify your account</Link>.</Notice>}
    <section aria-label="Workspace overview" className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line ${stats.length === 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : ""}`}>
      {stats.map(stat => <Link key={stat.label} href={stat.href} className="bg-bg p-4 transition-colors hover:bg-surface sm:p-6"><p className="text-xs text-muted sm:text-sm">{stat.label}</p><p className="mt-3 text-4xl font-medium tracking-tight tnum">{stat.value}</p><p className="mt-3 text-xs text-muted">{stat.hint}</p></Link>)}
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <Panel title="Your engagements" aside={<Link href="/pairings" className="hover:underline">View all &rarr;</Link>}>
          {pairs.length ? <ul className="divide-y divide-line">{pairs.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-5"><div><Link href={`/pairings/${p.id}`} className="font-medium hover:underline">{store.ventures.find(v => v.id === p.ventureId)?.name ?? "Engagement"}</Link><p className="mt-2 text-xs text-muted">{p.acceptedAt ? `Accepted ${formatDate(p.acceptedAt)}` : p.protocol === "operator_v1" ? "Awaiting acceptance" : "Historical record"}</p></div><div className="flex items-center gap-3"><Pill tone={STATE_TONE[p.state]}>{PAIRING_STATE_LABELS[p.state]}</Pill><Link href={`/pairings/${p.id}/agreement`} className="text-xs text-brand hover:underline">Agreement</Link></div></li>)}</ul> : <div className="py-8 sm:py-10"><div aria-hidden="true" className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-xl text-brand">&harr;</div><h3 className="text-lg font-medium">Your next partnership starts here.</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted">{builder ? "Manage your ventures and review applications. When you make an offer, you can follow its progress here." : "Find a venture you believe in and apply. Your offers and active partnerships will appear here."}</p><Link href={builder ? "/ventures" : "/bench"} className="mt-5 inline-block text-sm font-medium text-brand hover:underline">{builder ? "Go to your ventures" : "Explore the Bench"} &rarr;</Link></div>}
        </Panel>
        {store.applications.length > 0 && <section id="venture-applications" className="scroll-mt-36"><Panel title="Venture applications" aside={<span>{store.applications.length} total</span>}>
          {store.applications.length ? <ul className="divide-y divide-line">{store.applications.map(a => { const venture = store.ventures.find(v => v.id === a.ventureId); return <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><Link href={venture ? a.applicantId === user.id ? `/bench/${venture.slug}` : `/ventures/${venture.slug}/applications` : "/bench"} className="text-sm font-medium hover:underline">{venture?.name ?? "View venture"}</Link><p className="mt-1 text-xs text-muted">{store.users.find(u => u.id === a.applicantId)?.name ?? "Applicant"}</p></div><Pill>{a.status}</Pill></li>; })}</ul> : <div className="py-6"><p className="text-sm text-muted">{builder ? "Applications to your ventures will appear here." : "You have not applied to a venture yet."}</p><Link href={builder ? "/ventures" : "/bench"} className="mt-3 inline-block text-sm text-brand hover:underline">{builder ? "Manage listings" : "Find a venture"} &rarr;</Link></div>}
        </Panel></section>}
        {store.jobApplications.length > 0 && <section id="job-applications" className="scroll-mt-36"><Panel title="Job applications" aside={<Link href="/jobs" className="hover:underline">Browse jobs &rarr;</Link>}>
          {store.jobApplications.length ? <ul className="divide-y divide-line">{store.jobApplications.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><Link href={`/jobs/${a.openingId}`} className="text-sm font-medium hover:underline">{store.openings.find(o => o.id === a.openingId)?.title ?? "View role"}</Link><Pill>{a.status}</Pill></li>)}</ul> : <p className="py-6 text-sm text-muted">No job applications yet. Browse open roles to find a fit.</p>}
        </Panel></section>}
      </div>
      <aside aria-label="Account and activity" className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-line bg-surface/50 p-5"><div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{userInitials(user.name)}</span><div className="min-w-0"><h2 className="break-words font-medium">{user.name}</h2><p className="mt-1 text-xs capitalize text-muted">{user.roles.join(" / ")}</p></div></div><div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs"><span className="text-muted">Email</span><span className={user.emailVerifiedAt ? "text-green" : "text-muted"}>{user.emailVerifiedAt ? "Verified" : "Verification needed"}</span></div><Link href="/settings/verification" className="mt-4 block text-sm text-brand hover:underline">Account & verification &rarr;</Link></section>
        {admin && <section className="rounded-2xl border border-brand/20 bg-brand-soft p-5"><p className="text-xs font-medium text-brand">ADMINISTRATION</p><h2 className="mt-3 font-medium">Keep the platform moving.</h2><p className="mt-2 text-sm leading-6 text-muted">Review support requests, manage listings, and check email delivery.</p><Link href="/admin" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">Open operations &rarr;</Link></section>}
        <Panel title="Recent activity" aside={<Link href="/notifications" className="hover:underline">Inbox</Link>}>{notifications.length ? <Inbox items={notifications.slice(0, 4)} /> : <p className="py-5 text-sm leading-6 text-muted">You are all caught up. Updates to your applications and partnerships will appear here.</p>}</Panel>
        <p className="px-1 text-xs leading-5 text-muted">Need a hand? <Link href="/support" className="text-fg underline underline-offset-2">Contact support</Link>.</p>
      </aside>
    </div>
    {user.roles.includes("investor") && <Notice>Investor accounts can explore public ventures. Private engagement and financial records require disclosure directly from the authorized parties.</Notice>}
  </div>;
}

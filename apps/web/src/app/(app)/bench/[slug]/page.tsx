/* eslint-disable @next/next/no-img-element -- preserve original venture OG artwork */
import { PageHeader, Notice, LinkButton, Pill } from "@/components/ui";
import { CompensationSummary } from "@/components/compensation-summary";
import { getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/data/store";
import { getVentureBySlug, canManageVenture, isOnBench, milestonesFor } from "@/lib/services/ventures";
import { findApplication } from "@/lib/services/applications";
import { CATEGORY_LABELS, STAGE_LABELS, formatPhp } from "@/lib/format";
import { notFound } from "next/navigation";
import Link from "next/link";
export const dynamic="force-dynamic";
type Props={params:Promise<{slug:string}>;searchParams:Promise<Record<string,string>>};
export async function generateMetadata({params}:Props){const {slug}=await params;return {title:(await getVentureBySlug(slug))?.name ?? "Venture"};}
export default async function VenturePage({params,searchParams}:Props){
 const {slug}=await params;const q=await searchParams;const v=await getVentureBySlug(slug);const user=await getSession();
 if(!v) notFound();const manager=!!user && canManageVenture(user,v);
 if(!["published","development"].includes(v.status) && !manager) notFound();
 const open=await isOnBench(v);const terms=v.commercialTerms;const milestones=await milestonesFor(v.id);
 const existing=user?await findApplication(v.id,user.id):null;const store=await getStore();
 return <div className="max-w-5xl space-y-8">
  <PageHeader title={v.name} description={v.oneLiner} aside={<><Pill tone="neutral">{CATEGORY_LABELS[v.category]}</Pill><Pill tone="blue">{STAGE_LABELS[v.stage]}</Pill></>}/>
  {q.applied && <Notice tone="green">Application sent. An engagement starts only after you accept an offer.</Notice>}
  {v.status==="development" && <Notice>This project is in development. {open ? "Applications are open. Agree responsibilities and paid terms before work starts." : "Applications are currently closed."}</Notice>}
  {v.screenshots[0] && <div className="rounded-2xl border border-line overflow-hidden aspect-[1200/630] max-w-3xl"><img src={v.screenshots[0]} alt={`${v.name} preview`} className="w-full h-full object-cover" referrerPolicy="no-referrer"/></div>}
  <p className="text-muted leading-relaxed max-w-3xl whitespace-pre-line">{v.description}</p><a href={v.productUrl} target="_blank" rel="noreferrer" className="underline text-sm">Visit the product</a>
  {(v.status!=="development" || terms?.contractingParty) && <>
   <section className="grid gap-6 sm:grid-cols-2"><div><h2 className="font-medium">Builder commitments</h2><ul className="mt-3 space-y-2 text-sm text-muted">{v.builderHasDone.map(s=><li key={s}>{s}</li>)}</ul></div><div><h2 className="font-medium">Commercial responsibilities</h2><ul className="mt-3 space-y-2 text-sm text-muted">{v.counterpartWouldOwn.map(s=><li key={s}>{s}</li>)}</ul><p className="text-sm mt-3">{v.hoursPerWeek} hours per week expected.</p></div></section>
   <section><h2 className="display text-3xl mb-4">Published compensation</h2><CompensationSummary terms={terms}/><p className="mt-3 text-sm"><Link href={`/terms/${v.termsTemplateId}`} className="underline">Review the agreement template</Link>. Your accepted offer will save its exact values and scope.</p></section>
   <section><h2 className="display text-3xl mb-4">Performance goals</h2><ul className="divide-y divide-line border-y border-line">{milestones.map(m=><li key={m.id} className="py-4"><p className="font-medium">{m.title}</p><p className="text-sm text-muted mt-1">{v.metrics.find(x=>x.key===m.metricKey)?.label}: {m.targetValue} within {m.windowDays} days of opening. Performance goals do not grant equity.</p></li>)}</ul></section>
   <section><h2 className="font-medium">Reported traction and contribution estimate</h2><p className="text-muted mt-2">{v.tractionSummary}</p><p className="text-sm text-muted mt-2">Target contribution: {formatPhp(v.profitabilityTarget.monthlyContributionPhp)} per month. This excludes overhead and salaries; it is not verified net profit or available cash.</p></section>
  </>}
  <div className="flex flex-wrap gap-3 border-t border-line pt-6">
   {manager ? <LinkButton href={`/ventures/${slug}/applications`}>Review applications ({store.applicantCounts[v.id]??0})</LinkButton> : existing ? <Notice>Application status: {existing.status}. Check your Pairings page for offers.</Notice> : open && (v.status==="development" || terms?.contractingParty) ? <LinkButton href={user?`/bench/${slug}/apply`:`/login?next=/bench/${slug}/apply`}>Apply for the commercial role</LinkButton> : <Notice>Applications are currently closed.</Notice>}
   <LinkButton href="/bench" variant="secondary">Back to the Bench</LinkButton>
   <Link href={`/support?category=listing&venture=${encodeURIComponent(slug)}`} className="self-center text-sm text-muted underline">Report this listing</Link>
  </div>
 </div>;
}

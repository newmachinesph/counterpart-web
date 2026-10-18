import { TermsView } from "@/components/terms-view";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { Notice, Button } from "@/components/ui";
import { CompensationSummary } from "@/components/compensation-summary";
import { loadDashboardOr404 } from "../load";
import { commercialAction } from "../commercial-actions";
import Link from "next/link";
export const metadata = { title: "Recorded agreement" };
export default async function AgreementPage({params,searchParams}: {params:Promise<{id:string}>;searchParams:Promise<Record<string,string>>}) {
 const {id}=await params; const q=await searchParams; const user=await requireUser(`/pairings/${id}/agreement`);
 const d=await loadDashboardOr404(user,id); const p=d.pairing; const agreement=p.agreement;
 if (!agreement?.template) return <><Notice>Historical agreement. Existing records are preserved. Automated equity awards are paused for documented review; this does not determine or cancel existing legal rights.</Notice>{d.terms && <TermsView terms={d.terms} />}</>;
 const fill=(s:string)=>s.replace(/\[([A-Z_]+)\]/g,(all,key)=>agreement.values[key] || all);
 const terms={...agreement.template,sections:agreement.template.sections.map(s=>({heading:s.heading,body:fill(s.body)}))};
 return <div className="max-w-4xl space-y-6">
  <Link href={`/pairings/${id}`} className="underline text-sm">Back to engagement</Link>
  {q.error && <Notice tone="red">{q.error}</Notice>}{q.saved && <Notice tone="green">Agreement response recorded.</Notice>}
  <Notice>{p.acceptedAt ? `Accepted ${formatDate(p.acceptedAt)}. Work starts on this date.` : "Offer pending. Work has not started. The invited counterpart must accept within 14 days."} Version {agreement.template.id}.</Notice>
  <CompensationSummary terms={agreement.terms} />
  <TermsView terms={terms} context={`${d.builder.name} and ${d.counterpart.name} · ${d.venture.name}`} />
  <section className="rounded-xl border border-line p-5"><h2 className="font-medium">Saved performance goals</h2><ul className="mt-3 space-y-2 text-sm">{agreement.schedule.map(m=><li key={m.id}>{m.title}: {m.targetValue} · {m.windowDays} days. No equity award.</li>)}</ul><p className="mt-4 text-xs text-muted break-all">Document fingerprint: {agreement.hash}</p></section>
  {p.state === "offered" && user.id === p.counterpartId && <form action={commercialAction} className="rounded-xl border border-line p-5 space-y-4">
   <input type="hidden" name="pairingId" value={id}/><input type="hidden" name="kind" value="agreement"/><input type="hidden" name="agreementHash" value={agreement.hash}/>
   <label className="flex gap-3 text-sm"><input type="checkbox" required/>I have reviewed this exact agreement, compensation and scope, and agree to start the paid engagement on acceptance.</label>
   <Button name="action" value="accept" type="submit">Accept and start paid trial</Button>
  </form>}
  {p.state === "offered" && user.id === p.counterpartId && <form action={commercialAction}><input type="hidden" name="pairingId" value={id}/><input type="hidden" name="kind" value="agreement"/><input type="hidden" name="action" value="decline"/><Button variant="secondary" type="submit">Decline offer</Button></form>}
  {p.state === "proving_run" && <form action={commercialAction} className="space-y-3"><input type="hidden" name="pairingId" value={id}/><input type="hidden" name="kind" value="agreement"/>
   {user.id===p.builderId ? <><p className="text-sm text-muted">Propose continuing on these cash terms through day {agreement.terms.termDays}. The counterpart must agree.</p><Button name="action" value="request_continuation">Propose continuing partnership</Button></> : p.continuationRequestedAt ? <><p className="text-sm text-muted">The builder proposed continuing on these terms through day {agreement.terms.termDays}. This grants no equity.</p><Button name="action" value="continue">Agree to continue</Button></> : <p className="text-sm text-muted">Continuation beyond the trial requires a proposal from the builder and your acceptance.</p>}
  </form>}
 </div>;
}

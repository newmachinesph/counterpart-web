import { api } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/session";
import type { Pairing } from "@/lib/domain/types";
import { PageHeader, Notice, Button, INPUT_CLASS } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { commercialAction } from "../commercial-actions";
import Link from "next/link";

interface Data {
 pairing: Pairing; effectiveEnd: string | null;
 deals: {id:string;reference:string;evidence:string;registeredAt:string}[];
 claims: {id:string;reference:string;amountPhp:string;status:string;dueAt:string;evidence:string;events:{action:string;note:string;at:string}[]}[];
 cases: {id:string;message:string;status:string;resolution:string|null}[];
 revisions: {id:string;createdAt:string;snapshot:{values:Record<string,number>;note:string}}[];
 grants: {id:string;status:string;vestedUnits:number;terms:{entity:string;shareClass:string;grantUnits:number;capitalizationUnits:number;vestingMonths:number;cliffMonths:number;vestingStart:string;signedDocumentUrl:string;departureTerms:string;continuation:string;hash:string}}[];
}

function Fields({id,kind,record,hash}:{id:string;kind:string;record?:string;hash?:string}) {
 return <><input type="hidden" name="pairingId" value={id}/><input type="hidden" name="kind" value={kind}/>{record && <input type="hidden" name="recordId" value={record}/>}<input type="hidden" name="agreementHash" value={hash ?? ""}/></>;
}
function TextInput({name,label,type="text",value}:{name:string;label:string;type?:string;value?:number|string}) {
 return <label className="block text-sm">{label}<input name={name} type={type} defaultValue={value} required className={`${INPUT_CLASS} mt-1`} step={type==="number"?"0.01":type==="datetime-local"?"1":undefined}/></label>;
}
export const metadata={title:"Compensation & cofounder grants"};

export default async function CompensationPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string>>}) {
 const {id}=await params;const q=await searchParams;const user=await requireUser(`/pairings/${id}/compensation`);
 const d=await api<Data>(`/pairings/${id}/commercial`);const p=d.pairing;
 const operator=user.id===p.counterpartId,builder=user.id===p.builderId,admin=user.roles.includes("admin");
 // This server page evaluates the current contract boundary once per request.
 // eslint-disable-next-line react-hooks/purity
 const running=["proving_run","active","cofounder"].includes(p.state) && (!d.effectiveEnd || Date.now()<new Date(d.effectiveEnd).getTime());
 const accepted=p.protocol==="operator_v1" && !!p.acceptedAt;
 return <div className="max-w-4xl space-y-8">
  <PageHeader title="Compensation & grants" description="Evidence, amounts due, payment acknowledgments, and separately documented equity."/>
  <div className="flex gap-4 text-sm underline"><Link href={`/pairings/${id}`}>Engagement</Link><Link href={`/pairings/${id}/agreement`}>Recorded agreement</Link><Link href={`/pairings/${id}/review`}>Request review</Link></div>
  {q.error && <Notice tone="red">{q.error}</Notice>}{q.saved && <Notice tone="green">Saved to the engagement record.</Notice>}
  <Notice>Payments take place outside Counterpart. A builder can report payment; the operator confirms receipt. Disputes preserve the evidence and do not cancel undisputed compensation.</Notice>
  <section className="space-y-4"><h2 className="display text-3xl">Compensation record</h2>
   {d.claims.length===0 && <p className="text-muted">No claims recorded yet.</p>}
   {d.claims.map(c=><article key={c.id} className="border border-line rounded-2xl p-5 space-y-3">
    <div className="flex flex-wrap justify-between gap-3"><h3 className="font-medium">{c.reference}</h3><p className="tnum">{formatMoney(c.amountPhp)} · {c.status.replaceAll("_"," ")}</p></div>
    <p className="text-sm text-muted">Due {formatDate(c.dueAt)}</p><p className="text-sm whitespace-pre-line">{c.evidence}</p>
    <details className="text-sm"><summary className="cursor-pointer">Evidence and payment history</summary><ol className="mt-3 space-y-2">{c.events.map((e,i)=><li key={i}>{formatDate(e.at)} · {e.action.replaceAll("_"," ")} — {e.note}</li>)}</ol></details>
    <form action={commercialAction} className="space-y-3"><Fields id={id} kind="claim-action" record={c.id}/><label className="block text-sm">Evidence, dispute reason, or payment reference<textarea name="note" rows={2} required className={INPUT_CLASS}/></label><div className="flex flex-wrap gap-2">
     {builder && c.status==="submitted" && <Button name="action" value="confirm">Confirm payable</Button>}
     {builder && c.status==="confirmed" && <Button name="action" value="report_payment">Record payment sent</Button>}
     {operator && c.status==="payment_reported" && <Button name="action" value="acknowledge_payment">Confirm receipt</Button>}
     {(operator||builder) && ["submitted","confirmed","payment_reported"].includes(c.status) && <Button variant="secondary" name="action" value="dispute">Dispute with evidence</Button>}
     {admin && c.status==="disputed" && <><Button name="action" value="resolve_payable">Resolve as payable</Button><Button name="action" value="resolve_not_payable" variant="secondary">Resolve as not payable</Button></>}
    </div></form>
   </article>)}
  </section>
  <section className="space-y-4"><h2 className="display text-3xl">Registered deals</h2><p className="text-sm text-muted">Register during the engagement. A registration preserves the timestamp; collection claims still need attribution and receipt evidence.</p>
   {d.deals.map(deal=><p key={deal.id} className="text-sm"><strong>{deal.reference}</strong> · {formatDate(deal.registeredAt)} · {deal.evidence}</p>)}
   {operator && accepted && running && <form action={commercialAction} className="rounded-xl border border-line p-5 space-y-4"><Fields id={id} kind="deal"/><TextInput name="reference" label="Unique deal reference"/><TextInput name="evidence" label="Customer, attribution, and supporting evidence"/><Button>Register deal</Button></form>}
  </section>
  {operator && accepted && <div className="grid gap-5 md:grid-cols-2">
   <form action={commercialAction} className="border border-line rounded-2xl p-5 space-y-4"><h2 className="font-medium">Claim sales commission</h2><Fields id={id} kind="claim"/><input type="hidden" name="claimKind" value="commission"/>
    <label className="block text-sm">Registered deal<select name="dealId" required className={INPUT_CLASS}><option value="">Choose a deal</option>{d.deals.map(deal=><option key={deal.id} value={deal.id}>{deal.reference}</option>)}</select></label>
    <TextInput name="reference" label="Unique receipt reference"/><TextInput name="collectedAt" label="Collection date and time (UTC)" type="datetime-local"/><TextInput name="eligibleRevenuePhp" label="Eligible collected revenue, PHP" type="number"/><TextInput name="evidence" label="Receipt evidence and attribution"/><Button>Submit commission claim</Button>
   </form>
   <form action={commercialAction} className="border border-line rounded-2xl p-5 space-y-4"><h2 className="font-medium">Claim monthly fee</h2><p className="text-sm text-muted">Available after month-end or departure, prorated to active calendar days. The agreed fee is calculated from the saved contract.</p><Fields id={id} kind="claim"/><input type="hidden" name="claimKind" value="fee"/><input type="hidden" name="reference" value="monthly-fee"/><TextInput name="feeMonth" label="Fee month" type="month"/><TextInput name="evidence" label="Work record and supporting evidence"/><Button>Submit fee claim</Button></form>
  </div>}
  <section className="space-y-4"><h2 className="display text-3xl">Separate cofounder grants</h2><p className="text-sm text-muted">A signed instrument and company approvals are required. These records track the documented schedule; Counterpart does not issue shares or guarantee the capitalization. Vested units are contractual calculations, subject to that instrument.</p>
   {d.grants.length===0 && <p className="text-sm">No cofounder grant has been recorded.</p>}
   {d.grants.map(g=><article key={g.id} className="rounded-2xl border border-line p-5 space-y-3"><h3 className="font-medium">{g.terms.entity} · {g.status}</h3><p className="tnum text-sm">{g.terms.grantUnits.toLocaleString()} {g.terms.shareClass} units / {g.terms.capitalizationUnits.toLocaleString()} capitalization units at grant. {g.terms.vestingMonths} months, {g.terms.cliffMonths}-month cliff.</p><p className="text-sm">Vesting start {formatDate(g.terms.vestingStart)} · {g.vestedUnits.toLocaleString()} contractual units vested.</p><p className="text-sm text-muted">{g.terms.continuation}</p><p className="text-sm whitespace-pre-line">{g.terms.departureTerms}</p><a href={g.terms.signedDocumentUrl} target="_blank" rel="noreferrer" className="underline text-sm">Review signed instrument</a>
    {operator && g.status==="offered" && <form action={commercialAction} className="space-y-3"><Fields id={id} kind="grant-action" record={g.id} hash={g.terms.hash}/><label className="flex gap-2 text-sm"><input type="checkbox" required/>I reviewed and agree to the signed instrument, continued engagement, vesting, and departure terms.</label><Button name="action" value="accept">Accept documented cofounder grant</Button></form>}
    {operator && g.status==="offered" && <form action={commercialAction}><Fields id={id} kind="grant-action" record={g.id}/><Button name="action" value="decline" variant="secondary">Decline grant</Button></form>}
   </article>)}
   {builder && p.state==="active" && <details className="border border-line rounded-2xl p-5"><summary className="cursor-pointer font-medium">Record a separate cofounder offer after the trial</summary><form action={commercialAction} className="mt-5 space-y-4"><Fields id={id} kind="grant"/>
    <TextInput name="entity" label="Legal issuing company"/><TextInput name="shareClass" label="Share class / instrument"/>
    <div className="grid gap-4 sm:grid-cols-2"><TextInput name="grantUnits" label="Grant units" type="number"/><TextInput name="capitalizationUnits" label="Fully diluted capitalization units at grant" type="number"/><TextInput name="vestingMonths" label="Vesting months" type="number" value={48}/><TextInput name="cliffMonths" label="Cliff months" type="number" value={12}/></div>
    <TextInput name="vestingStart" label="Vesting start (UTC)" type="datetime-local"/><TextInput name="signedDocumentUrl" label="Private link to signed instrument" type="url"/><TextInput name="approvalReference" label="Corporate approval and legal review references"/>
    <label className="block text-sm">Departure, dilution, transfer, and any funded buyback terms<textarea name="departureTerms" rows={5} minLength={30} required className={INPUT_CLASS}/></label>
    <Notice>Acceptance continues the engagement beyond its original fixed term. Cash terms continue until a new written agreement or departure. The signed instrument must reflect this arrangement.</Notice>
    <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmsAuthorityAndReview" required/>I am authorized, the document and approvals have been reviewed, and the instrument matches these terms.</label><Button>Offer documented cofounder grant</Button>
   </form></details>}
  </section>
  <section className="space-y-4"><h2 className="display text-3xl">Review cases</h2>{d.cases.length===0 && <p className="text-muted">No review cases.</p>}{d.cases.map(c=><article key={c.id} className="rounded-xl border border-line p-4"><p className="text-sm whitespace-pre-line">{c.message}</p><p className="text-sm text-muted mt-2">{c.status} {c.resolution}</p>{admin && c.status==="open" && <form action={commercialAction} className="mt-3 space-y-3"><Fields id={id} kind="case" record={c.id}/><textarea name="note" minLength={20} required className={INPUT_CLASS} aria-label="Documented resolution"/><Button>Record resolution</Button></form>}</article>)}</section>
  <details className="border-t border-line pt-5"><summary className="cursor-pointer text-sm">Ledger revision history ({d.revisions.length})</summary><ol className="mt-3 space-y-2 text-sm">{d.revisions.map(r=><li key={r.id}>{formatDate(r.createdAt)} · {JSON.stringify(r.snapshot.values)} · {r.snapshot.note}</li>)}</ol></details>
 </div>;
}

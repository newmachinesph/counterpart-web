import Link from "next/link";
import type { PairingDashboard } from "@/lib/services/pairings";
import type { User } from "@/lib/domain/types";
import { PageHeader, LinkButton, Card, Notice, Button, INPUT_CLASS } from "./ui";
import { formatDate, formatPhp, PAIRING_STATE_LABELS } from "@/lib/format";
import { CompensationSummary } from "./compensation-summary";
import { endPairingAction } from "@/app/(app)/pairings/[id]/actions";

export function CommercialDashboard({ d, user, error }: { d: PairingDashboard; user: User; error?: string }) {
 const p=d.pairing; const running=["proving_run","active","cofounder"].includes(p.state);
 return <div className="space-y-8 max-w-5xl">
  <PageHeader title={d.venture.name} description={`${d.builder.name} & ${d.counterpart.name} · ${PAIRING_STATE_LABELS[p.state]}`} />
  {error && <Notice tone="red">{error}</Notice>}
  {p.state==="offered" ? <Notice>Review the saved offer. The trial starts only when the invited counterpart accepts.</Notice> : <p className="text-sm text-muted">Started {formatDate(p.acceptedAt)}{p.endedAt ? ` · Ended ${formatDate(p.endedAt)}` : ""}. The performance ledger does not grant shares or confirm payment.</p>}
  <div className="flex flex-wrap gap-3"><LinkButton href={`/pairings/${p.id}/agreement`}>Agreement & acceptance</LinkButton><LinkButton href={`/pairings/${p.id}/compensation`} variant="secondary">Compensation & grants</LinkButton>
   {running && user.id===p.counterpartId && <LinkButton href={`/pairings/${p.id}/log`} variant="secondary">Log this week</LinkButton>}
   <LinkButton href={`/pairings/${p.id}/chat`} variant="secondary">Conversation</LinkButton><LinkButton href={`/pairings/${p.id}/review`} variant="secondary">Request review</LinkButton>
  </div>
  <CompensationSummary terms={p.agreement?.terms} />
  <section><h2 className="display text-3xl mb-4">Performance record</h2><p className="text-sm text-muted mb-4">Reported cumulative revenue: {formatPhp(d.cards.revenue.value)}. Figures are supplied by the operator and may require evidence review.</p>
   <div className="grid gap-3 sm:grid-cols-2">{d.milestones.map(m=><Card key={m.id}><p className="font-medium">{m.title}</p><p className="text-sm text-muted mt-2">Target {m.targetValue} · {m.windowDays} days · {m.status}</p><p className="text-xs text-muted mt-2">A performance goal; no automatic equity award.</p></Card>)}</div>
  </section>
  <section><h2 className="display text-3xl mb-4">Weekly ledger</h2>{d.weeks.filter(w=>w.entry).length===0 ? <p className="text-muted">No results logged yet.</p> : <ul className="divide-y divide-line">{d.weeks.filter(w=>w.entry).map(w=><li key={w.weekStarting} className="py-4"><p className="font-medium">Week of {formatDate(w.weekStarting)}</p><p className="text-sm tnum mt-1">{Object.entries(w.entry!.values).map(([key,value])=>`${d.venture.metrics.find(m=>m.key===key)?.label ?? key}: ${value}`).join(" · ")}</p><p className="text-sm text-muted mt-2">{w.entry!.note}</p><div className="flex gap-3 mt-2">{w.entry!.evidenceLinks.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer" className="text-sm underline">Evidence {i+1}</a>)}</div></li>)}</ul>}</section>
  {(running || p.state==="offered") && <section className="border-t border-line pt-6"><h2 className="font-medium">End this engagement</h2><p className="text-sm text-muted my-3">Future work stops. Accrued compensation, the agreed pipeline tail, and existing documented equity rights remain subject to the agreement.</p><form action={endPairingAction} className="space-y-3"><input type="hidden" name="pairingId" value={p.id}/><label className="block text-sm">Reason and handover plan<textarea name="reason" rows={3} required className={INPUT_CLASS}/></label><Button type="submit" variant="danger">End engagement</Button></form></section>}
  <Link href="/pairings" className="text-sm underline">All engagements</Link>
 </div>;
}

"use client";
import { useActionState } from "react";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/ui";
import type { CommercialTerms } from "@/lib/domain/types";
import { type ApplyState, submitApplicationAction } from "./actions";

export function ApplyForm({ slug, terms }: { slug: string; terms?: CommercialTerms | null }) {
 const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplicationAction.bind(null, slug), {errors: {}, formError: null});
 return <form action={action} className="space-y-6">
  {terms?.contractingParty ? <Notice>Paid commercial role: PHP {Number(terms.monthlyFeePhp).toLocaleString()} monthly fee and {terms.commissionRatePct}% of eligible collected sales. Review the full terms on the venture page. An application does not start work or grant equity.</Notice> : <Notice>Compensation and responsibilities are still to be agreed. You can apply now; the builder must provide a paid offer for you to accept before work starts. An application does not grant equity.</Notice>}
  {state.formError && <Notice tone="red">{state.formError} {Object.values(state.errors).join(". ")}</Notice>}
  <input type="hidden" name="compensation" value="cash" /><input type="hidden" name="track" value="counterpart" />
  <input type="hidden" name="requestedEquityPct" value="0" /><input type="hidden" name="templateId" value="operator_v1" />
  <Field htmlFor="evidence" label="What have you sold, grown, or launched?" error={state.errors.evidence} hint="Specific results, at least 200 characters."><textarea id="evidence" name="evidence" rows={6} minLength={200} required className={INPUT_CLASS} /></Field>
  <Field htmlFor="proofLinks" label="Proof links" hint="One full https:// link per line."><textarea id="proofLinks" name="proofLinks" rows={3} required className={INPUT_CLASS} /></Field>
  <fieldset><legend className="text-sm mb-2">A result you personally delivered</legend><div className="grid gap-2 sm:grid-cols-2">{[["metric","Metric"],["before","Before"],["after","After"],["timeframe","Timeframe"]].map(([key,label]) => <label key={key} className="text-sm">{label}<input name={`nm_${key}`} required className={INPUT_CLASS} /></label>)}</div></fieldset>
  <Field htmlFor="hoursPerWeek" label="Hours available per week"><input id="hoursPerWeek" name="hoursPerWeek" type="number" min={1} max={80} required className={INPUT_CLASS} /></Field>
  <Field htmlFor="commitments" label="Resources and support you bring"><textarea id="commitments" name="commitments" rows={3} className={INPUT_CLASS} /></Field>
  <Field htmlFor="whyThisVenture" label="Why this venture?"><textarea id="whyThisVenture" name="whyThisVenture" minLength={20} rows={4} required className={INPUT_CLASS} /></Field>
  <Button type="submit" disabled={pending}>{pending ? "Sending" : "Apply for this role"}</Button>
 </form>;
}

import { Field, INPUT_CLASS } from "./ui";

export const COMMERCIAL_NUMBERS = [
  ["trialDays", "Paid trial, days", 45, 1, 90], ["termDays", "Total engagement, days", 180, 1, 730],
  ["monthlyFeePhp", "Monthly fee, PHP", 0, 0, 10000000], ["commissionRatePct", "Commission, %", 0, 0, 100],
  ["paymentDays", "Payment due within, days", 15, 1, 60], ["tailDays", "Post-exit collection tail, days", 90, 0, 365],
] as const;
export const COMMERCIAL_TEXT = [
  ["contractingParty", "Legal contracting party", "Full legal name of the person or company responsible for payment."],
  ["eligibleRevenue", "Eligible collected revenue", "Define included sales, taxes, refunds, cancellations, renewals, and any exclusions."],
  ["attribution", "Which sales qualify", "Define eligible customers, deal registration, shared credit, and pre-existing accounts."],
  ["expensePolicy", "Expenses and approvals", "State who pays, agreed limits, and approval requirements."],
  ["disputeProcess", "Dispute process", "Agree an escalation contact, response times, mediation, applicable law, and forum."],
] as const;

export function CommercialTermsFields({ errors = {} }: { errors?: Record<string, string> }) {
  return <fieldset className="rounded-2xl border border-line p-5 space-y-5">
    <legend className="px-2 font-medium">The paid commercial agreement</legend>
    <p className="text-sm text-muted">Choose a fee, commission, or both. These terms are saved with the offer. Performance milestones do not grant equity.</p>
    <div className="grid gap-4 sm:grid-cols-2">{COMMERCIAL_NUMBERS.map(([key, label, value, min, max]) => <Field key={key} htmlFor={key} label={label} error={errors[`commercialTerms.${key}`]}>
      <input id={key} name={key} type="number" step={key.includes("Php") || key.includes("Pct") ? "0.01" : "1"} min={min} max={max} defaultValue={value} required className={INPUT_CLASS} />
    </Field>)}</div>
    {COMMERCIAL_TEXT.map(([key, label, hint]) => <Field key={key} htmlFor={key} label={label} hint={hint} error={errors[`commercialTerms.${key}`]}>
      <textarea id={key} name={key} rows={3} minLength={key === "contractingParty" ? 3 : 20} maxLength={3000} required className={INPUT_CLASS} />
    </Field>)}
  </fieldset>;
}

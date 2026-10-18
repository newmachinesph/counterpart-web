import type { CommercialTerms } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";

export function CompensationSummary({ terms }: { terms?: CommercialTerms }) {
 if (!terms?.contractingParty) return <p className="text-sm text-muted">Commercial terms will be published before applications open.</p>;
 return <section className="rounded-2xl border border-line p-5 space-y-5" aria-label="Commercial compensation">
  <div className="grid gap-5 sm:grid-cols-3">
   <div><p className="text-xs text-muted">Monthly fee</p><p className="text-2xl tnum">{formatMoney(Number(terms.monthlyFeePhp))}</p></div>
   <div><p className="text-xs text-muted">Eligible collected sales</p><p className="text-2xl tnum">{terms.commissionRatePct}% commission</p></div>
   <div><p className="text-xs text-muted">Paid trial / total term</p><p className="text-2xl tnum">{terms.trialDays} / {terms.termDays} days</p></div>
  </div>
  <dl className="space-y-3 text-sm">{[["Contracting party",terms.contractingParty],["Eligible revenue",terms.eligibleRevenue],["Attribution",terms.attribution],["Expenses",terms.expensePolicy],["Disputes",terms.disputeProcess]].map(([label,value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-muted whitespace-pre-line mt-1">{value}</dd></div>)}</dl>
  <p className="text-sm text-muted">Payments are due within {terms.paymentDays} days. Eligible pre-exit deals have a {terms.tailDays}-day collection tail. Accrued compensation survives departure. This agreement grants no equity.</p>
 </section>;
}

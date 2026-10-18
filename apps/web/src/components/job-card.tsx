import Link from "next/link";
import { ARRANGEMENT_LABELS, OPENING_TYPE_LABELS, payLabel } from "@/lib/domain/openings";
import { formatPhp, pluralize } from "@/lib/format";
import type { OpeningCard } from "@/lib/services/openings";
import { PairingMark } from "./illustrations";
import { Pill } from "./ui";

export function FundingLine({ card }: { card: OpeningCard }) {
  const { opening, ledgerRevenuePhp } = card;
  if (opening.fundedBy === "ledger_revenue") {
    return (
      <span className="text-green">
        Paid from {formatPhp(ledgerRevenuePhp)} a month on the traction ledger
      </span>
    );
  }
  if (opening.fundedBy === "outside_funding") return <span className="text-muted">Paid from the builder&apos;s own funds</span>;
  if (opening.fundedBy === "commission_only") return <span className="text-muted">Commission only, no base pay</span>;
  return <span className="text-muted">Equity only, no pay</span>;
}

export function JobCard({ card }: { card: OpeningCard }) {
  const { opening, venture, applicantCount } = card;
  return (
    <article className="rounded-2xl border border-line bg-bg p-5 flex flex-col gap-3 h-full">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-surface flex items-center justify-center">
          {venture ? <span className="text-xs font-medium">{venture.name.slice(0, 2)}</span> : <PairingMark size={18} />}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-medium leading-snug">
            <Link href={`/jobs/${opening.id}`} className="hover:underline">
              {opening.title}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {venture ? venture.name : "Counterpart"} · {opening.team}
          </p>
        </div>
      </div>
      <p className="text-sm">{opening.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="neutral">{OPENING_TYPE_LABELS[opening.type]}</Pill>
        <Pill tone="neutral">{ARRANGEMENT_LABELS[opening.arrangement]}</Pill>
        <Pill tone="neutral">{opening.location}</Pill>
        {venture === null ? <Pill tone="blue">Counterpart</Pill> : null}
      </div>
      <div className="mt-auto border-t border-line pt-3">
        <div className="font-medium tnum">{payLabel(opening)}</div>
        <div className="text-xs mt-0.5">
          <FundingLine card={card} />
        </div>
        {applicantCount > 0 && <div className="text-xs text-muted mt-1 tnum">{pluralize(applicantCount, "applicant")}</div>}
      </div>
    </article>
  );
}
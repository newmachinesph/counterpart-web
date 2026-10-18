import Link from "next/link";
import { CategoryGlyph } from "@/components/illustrations";
import type { BenchCard } from "@/lib/services/ventures";
import { CATEGORY_LABELS, STAGE_LABELS, formatPhp, pluralize } from "@/lib/format";
import { Pill } from "./ui";

export function VentureCard({ card }: { card: BenchCard }) {
  const { venture, applicantCount } = card;
  const shot = venture.screenshots[0] || venture.logoUrl;
  const development = venture.status === "development";
  return (
    <article className="rounded-2xl border border-line overflow-hidden flex flex-col bg-bg text-fg h-full">
      <Link href={`/bench/${venture.slug}`} className="block shrink-0 bg-surface border-b border-line aspect-[1200/630] overflow-hidden">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : null}
      </Link>
      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-brand-soft text-brand flex items-center justify-center">
            {venture.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venture.logoUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : <CategoryGlyph category={venture.category} />}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-medium leading-snug">
              <Link href={`/bench/${venture.slug}`} className="hover:underline">
                {venture.name}
              </Link>
            </h3>
            <p className="text-sm text-muted">
              {CATEGORY_LABELS[venture.category]}
              {venture.location ? `, ${venture.location}` : ""}
            </p>
          </div>
        </div>
        <p className="text-sm line-clamp-3">{venture.oneLiner}</p>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone="neutral">{STAGE_LABELS[venture.stage]}</Pill>
          <Pill tone="neutral">{safeHost(venture.productUrl)}</Pill>
          {venture.internsWelcome ? <Pill tone="blue">Interns welcome</Pill> : null}
        </div>
        {development ? <div className="mt-auto border-t border-line pt-3 text-sm text-muted"><p>In development. Applications open.</p><p className="mt-1">{venture.commercialTerms?.contractingParty ? "Paid terms available on the venture page." : "Compensation and responsibilities to be agreed before work starts."}</p>{applicantCount > 0 && <p className="mt-1">{pluralize(applicantCount, "application", "applications")}</p>}</div> : <>
        <p className="text-sm text-muted tnum">{venture.tractionSummary}</p>
        <p className="text-sm tnum"><span className="text-muted">Target </span>{formatPhp(venture.profitabilityTarget.monthlyContributionPhp)}<span className="text-muted"> contribution a month within {venture.profitabilityTarget.withinDays} days</span></p>
        <dl className={`mt-auto grid ${applicantCount > 0 ? "grid-cols-3" : "grid-cols-2"} gap-3 border-t border-line pt-3 text-sm`}>
          <div>
            <dt className="text-xs text-muted">Compensation</dt>
            <dd className="font-medium tnum">
              {venture.commercialTerms ? `${venture.commercialTerms.commissionRatePct}% + ${formatPhp(Number(venture.commercialTerms.monthlyFeePhp))}/mo` : "Terms pending"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Hours a week</dt>
            <dd className="font-medium tnum">{venture.hoursPerWeek}</dd>
          </div>
          {applicantCount > 0 && <div>
            <dt className="text-xs text-muted">Applied</dt>
            <dd className="font-medium tnum">{pluralize(applicantCount, "person", "people")}</dd>
          </div>}
        </dl>
        </>}
      </div>
    </article>
  );
}

export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

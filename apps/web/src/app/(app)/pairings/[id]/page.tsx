import { CommercialDashboard } from "@/components/commercial-dashboard";
import { Progress } from "@/components/dashboard";
import { LedgerChart } from "@/components/ledger-chart";
import { MilestoneList } from "@/components/milestone-list";
import { Button, Card, INPUT_CLASS, LinkButton, Notice, PageHeader, Pill, SectionTitle, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { profitabilityProgress } from "@/lib/domain/equity";
import { isTerminalState } from "@/lib/domain/pairing";
import { PAIRING_STATE_LABELS, formatDate, formatMetric, formatPct } from "@/lib/format";
import type { Metadata } from "next";
import Link from "next/link";
import { STATE_TONE } from "../page";
import { commentAction, endPairingAction } from "./actions";
import { loadDashboardOr404 } from "./load";

export const metadata: Metadata = { title: "Pairing" };
export const dynamic = "force-dynamic";

export default async function PairingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/pairings/${id}`);
  const now = new Date();

  const d = await loadDashboardOr404(user, id, now);

  const { pairing, venture, milestones, cards, openMilestone } = d;
  const ended = isTerminalState(pairing.state);
  const isCounterpart = user.id === pairing.counterpartId;
  const isBuilder = user.id === pairing.builderId || user.roles.includes("admin");
  const error = typeof query.error === "string" ? query.error : null;
  if (d.pairing.protocol === "operator_v1") return <CommercialDashboard d={d} user={user} error={error ?? undefined} />;
  const currentMetric = venture.metrics.find((m) => m.key === (openMilestone?.metricKey ?? venture.metrics[0]?.key));
  const revenueMetric = venture.metrics.find((m) => m.unit === "php") ?? null;
  const gaps = d.weeks.filter((w) => w.closed && !w.entry).length;
  const profit = profitabilityProgress(d.weeks.flatMap((w) => (w.entry ? [w.entry] : [])), venture, now);

  return (
    <div className="flex flex-col gap-8">
      {error ? <Notice tone="red">{error}</Notice> : null}
      {query.logged === "1" ? <Notice tone="green">Week logged. Milestones were re-checked against the ledger.</Notice> : null}
      {query.reviewed === "1" ? <Notice tone="green">Review requested. The other party and the admins were notified.</Notice> : null}

      <PageHeader
        title={venture.name}
        description={
          <>
            {d.builder.name} (builder) and {d.counterpart.name} (Counterpart).{" "}
            <Link href={`/bench/${venture.slug}`} className="underline text-fg">
              Venture page
            </Link>
            .
          </>
        }
        aside={
          <div className="flex items-center gap-2">
            <Pill tone={STATE_TONE[pairing.state]}>{PAIRING_STATE_LABELS[pairing.state]}</Pill>
            <span className="text-sm text-muted tnum">
              Day {d.dayCount}
              {d.provingRunDaysLeft !== null ? `, ${d.provingRunDaysLeft} left in the proving run` : ""}
            </span>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label={openMilestone ? `${cards.current.label}, against the open milestone` : cards.current.label}
            value={formatMetric(cards.current.value, cards.current.unit)}
            sub={cards.current.target !== null ? `of ${formatMetric(cards.current.target, cards.current.unit)} target` : "no open milestone"}
            tone={cards.current.target !== null && cards.current.value >= cards.current.target ? "green" : undefined}
          />
        </Card>
        <Card>
          <Stat label="Cumulative revenue" value={formatMetric(cards.revenue.value, "php")} sub="since the pairing started" />
        </Card>
        <Card>
          <Stat
            label="Equity vested"
            value={formatPct(cards.equity.vestedPct)}
            sub={`of ${formatPct(cards.equity.onOfferPct)} on offer`}
            tone={cards.equity.vestedPct > 0 ? "green" : undefined}
          />
        </Card>
        <Card>
          <Stat
            label="Contribution run rate"
            value={formatMetric(profit.contributionPhp, "php")}
            sub={`of ${formatMetric(profit.targetPhp, "php")} target a month, ${profit.marginPct}% margin`}
            tone={profit.pct >= 100 ? "green" : undefined}
          />
          <div className="mt-3"><Progress value={profit.contributionPhp} max={profit.targetPhp} tone={profit.pct >= 100 ? "green" : "blue"} /></div>
          <div className="mt-1 text-xs text-muted tnum">{profit.pct}% of target, from the last {profit.weeksCounted} logged weeks. Excludes {venture.profitabilityTarget.excludes.join(", ").toLowerCase()}.</div>
        </Card>
      </section>

      {pairing.state === "proving_run" && pairing.provingRunDeliverables.length > 0 ? (
        <section>
          <SectionTitle>Proving run deliverables</SectionTitle>
          <ul className="text-sm flex flex-col gap-1">
            {pairing.provingRunDeliverables.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-muted">-</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">
            Historical engagement: automatic equity awards are paused for documented review. Recorded rights and accrued payment obligations remain governed by the accepted agreement.
          </p>
        </section>
      ) : null}

      <section>
        <SectionTitle aside={`${formatPct(cards.equity.vestedPct)} vested, ${formatPct(cards.equity.onOfferPct)} on offer`}>
          Milestones
        </SectionTitle>
        <MilestoneList milestones={milestones} metrics={venture.metrics} vesting={d.vesting} showStatus />
        {d.voided.length > 0 ? (
          <p className="mt-2 text-sm text-muted tnum">
            Voided: {d.voided.map((v) => `${formatPct(v.tranchePct)} (${v.reason})`).join(", ")}. Vested equity is never reduced.
          </p>
        ) : null}
      </section>

      <section id="ledger">
        <SectionTitle aside={gaps > 0 ? `${gaps} missed ${gaps === 1 ? "week" : "weeks"}` : "no missed weeks"}>
          Traction ledger, last 8 weeks
        </SectionTitle>
        {currentMetric ? (
          <LedgerChart weeks={d.lastEightWeeks} metric={currentMetric} target={openMilestone?.targetValue ?? null} />
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm tnum">
            <thead className="text-xs text-muted text-left">
              <tr>
                <th className="font-medium pb-1 pr-3">Week</th>
                {venture.metrics.map((m) => (
                  <th key={m.key} className="font-medium pb-1 pr-3">{m.label}</th>
                ))}
                <th className="font-medium pb-1">Note</th>
              </tr>
            </thead>
            <tbody>
              {[...d.lastEightWeeks].reverse().map((w) => (
                <tr key={w.weekStarting} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {formatDate(w.weekStarting)}
                    {!w.closed ? <span className="text-blue"> open</span> : null}
                  </td>
                  {venture.metrics.map((m) => (
                    <td key={m.key} className="py-1.5 pr-3">
                      {w.entry ? formatMetric(w.entry.values[m.key] ?? 0, m.unit) : w.closed ? <span className="text-red">no entry</span> : <span className="text-muted">not yet</span>}
                    </td>
                  ))}
                  <td className="py-1.5 text-muted">{w.entry?.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {d.latestEntry ? (
          <Card className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-medium">Latest entry, week of {formatDate(d.latestEntry.weekStarting)}</div>
              <div className="text-xs text-muted tnum">Logged {formatDate(d.latestEntry.updatedAt)}</div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3">
              {venture.metrics.map((m) => (
                <div key={m.key}>
                  <dt className="text-xs text-muted">{m.label}</dt>
                  <dd className="text-lg font-medium tnum">{formatMetric(d.latestEntry!.values[m.key] ?? 0, m.unit)}</dd>
                </div>
              ))}
            </dl>
            {d.latestEntry.note ? <p className="mt-3 text-sm">{d.latestEntry.note}</p> : null}
            {d.latestEntry.evidenceLinks.length > 0 ? (
              <ul className="mt-2 text-sm flex flex-col gap-1">
                {d.latestEntry.evidenceLinks.map((l) => (
                  <li key={l}>
                    <a href={l} target="_blank" rel="noreferrer" className="underline break-all">{l}</a>
                  </li>
                ))}
              </ul>
            ) : null}
            {d.latestEntry.comments.length > 0 ? (
              <ul className="mt-3 border-t border-line pt-3 flex flex-col gap-2 text-sm">
                {d.latestEntry.comments.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{d.users.get(c.authorId)?.name ?? "Builder"}</span>{" "}
                    <span className="text-muted tnum">{formatDate(c.createdAt)}</span>
                    <div>{c.body}</div>
                  </li>
                ))}
              </ul>
            ) : null}
            {isBuilder ? (
              <form action={commentAction} className="mt-3 flex gap-2">
                <input type="hidden" name="pairingId" value={pairing.id} />
                <input type="hidden" name="entryId" value={d.latestEntry.id} />
                <input name="body" required placeholder="Comment on this entry" className={INPUT_CLASS} aria-label="Comment" />
                <Button type="submit" variant="secondary">Comment</Button>
              </form>
            ) : null}
          </Card>
        ) : (
          <p className="mt-4 text-sm text-muted">No ledger entries yet.</p>
        )}
      </section>

      <section className="border-t border-line pt-6">
        <SectionTitle>Actions</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {isCounterpart && !ended ? (
            <LinkButton href={`/pairings/${pairing.id}/log`}>
              {d.thisWeekEntry ? "Edit this week" : "Log this week"}
            </LinkButton>
          ) : null}
          <LinkButton href={`/pairings/${pairing.id}/agreement`} variant="secondary">View agreement</LinkButton>
          {(isCounterpart || isBuilder || user.roles.includes("admin")) ? <LinkButton href={`/pairings/${pairing.id}/chat`} variant="secondary">Open conversation</LinkButton> : null}
          {!ended && (isCounterpart || isBuilder) ? (
            <LinkButton href={`/pairings/${pairing.id}/review`} variant="secondary">Request review</LinkButton>
          ) : null}
        </div>
        {revenueMetric === null ? <p className="mt-2 text-xs text-muted">This venture has no revenue metric; the revenue card stays at zero.</p> : null}

        {!ended && (isCounterpart || isBuilder) ? (
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-muted">
              {pairing.state === "proving_run" ? "End the proving run" : "Release from this pairing"}
            </summary>
            <form action={endPairingAction} className="mt-3 flex flex-col gap-3 max-w-md">
              <input type="hidden" name="pairingId" value={pairing.id} />
              <p className="text-muted">
                {pairing.state === "proving_run"
                  ? "Future work stops. Existing rights and accrued compensation remain subject to the recorded agreement."
                  : `Vested equity (${formatPct(cards.equity.vestedPct)}) stays vested and is recorded permanently. Unvested tranches are voided. The venture returns to the Bench.`}
              </p>
              <textarea name="reason" rows={2} placeholder="Reason, optional" className={INPUT_CLASS} />
              <div>
                <Button type="submit" variant="danger">
                  {pairing.state === "proving_run" ? "End proving run" : "Release"}
                </Button>
              </div>
            </form>
          </details>
        ) : null}

        {ended ? (
          <p className="mt-4 text-sm text-muted tnum">
            Ended {formatDate(pairing.endedAt)}
            {pairing.endedBy ? ` by ${d.users.get(pairing.endedBy)?.name ?? "a party"}` : ""}
            {pairing.endReason ? `: ${pairing.endReason}` : "."}
          </p>
        ) : null}
      </section>
    </div>
  );
}

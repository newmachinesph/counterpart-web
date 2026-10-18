import Link from "next/link";
import type { ReactNode } from "react";
import type { Notification, PairingState } from "@/lib/domain/types";
import { PAIRING_STATE_LABELS, formatDate, formatMetric, formatPct } from "@/lib/format";
import type { PairingDashboard } from "@/lib/services/pairings";
import { Pill, type Tone } from "./ui";

export const STATE_TONE: Record<PairingState, Tone> = {
  offered: "blue", declined: "gray", cofounder: "green",
  proving_run: "blue",
  active: "green",
  completed: "green",
  released: "gray",
  lapsed: "red",
};

export function Tiles({ items }: { items: Array<{ label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }> }) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-line bg-bg p-4 sm:p-5">
          <div className="text-xs text-muted">{it.label}</div>
          <div className={`mt-1 text-3xl sm:text-4xl font-medium tnum tracking-tight ${it.tone === "green" ? "text-green" : it.tone === "red" ? "text-red" : it.tone === "blue" ? "text-blue" : ""}`}>{it.value}</div>
          {it.sub ? <div className="mt-1 text-sm text-muted">{it.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Progress({ value, max, tone = "blue" }: { value: number; max: number; tone?: "blue" | "green" | "red" | "gray" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = tone === "green" ? "bg-green" : tone === "red" ? "bg-red" : tone === "gray" ? "bg-gray" : "bg-brand";
  return (
    <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Panel({ title, aside, children, empty }: { title: ReactNode; aside?: ReactNode; children?: ReactNode; empty?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-bg">
      <div className="flex items-baseline justify-between gap-4 px-4 sm:px-5 py-3.5 border-b border-line">
        <h2 className="font-medium">{title}</h2>
        {aside ? <div className="text-sm text-muted">{aside}</div> : null}
      </div>
      <div className="px-4 sm:px-5">{children ?? <p className="py-6 text-sm text-muted">{empty}</p>}</div>
    </section>
  );
}

function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000);
}

/** One pairing, at a glance: state, who, open milestone progress, ledger health. */
export function PairingRow({ d, now, viewer }: { d: PairingDashboard; now: Date; viewer: "builder" | "counterpart" | "reader" }) {
  const open = d.openMilestone;
  const metric = open ? d.venture.metrics.find((m) => m.key === open.metricKey) : null;
  const gaps = d.weeks.filter((w) => w.closed && !w.entry).length;
  const logged = d.weeks.filter((w) => w.entry).length;
  const live = d.pairing.state === "proving_run" || d.pairing.state === "active";
  const deadline = open ? daysUntil(d.milestones.find((m) => m.id === open.id)?.deadline ?? null, now) : null;
  const other = viewer === "builder" ? d.counterpart : viewer === "counterpart" ? d.builder : null;

  return (
    <div className="py-4 grid gap-4 md:grid-cols-[1.2fr_1.4fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/pairings/${d.pairing.id}`} className="font-medium hover:underline">
            {d.venture.name}
          </Link>
          <Pill tone={STATE_TONE[d.pairing.state]}>{PAIRING_STATE_LABELS[d.pairing.state]}</Pill>
        </div>
        <div className="mt-0.5 text-sm text-muted">
          {other ? `${other.name}. ` : `${d.builder.name} and ${d.counterpart.name}. `}
          Day {d.dayCount}
          {d.provingRunDaysLeft !== null ? `, ${d.provingRunDaysLeft} left in the proving run` : ""}.
        </div>
      </div>
      <div className="min-w-0">
        {open && metric ? (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{open.title}</span>
              <span className="tnum text-muted shrink-0">
                {formatMetric(d.cards.current.value, metric.unit)} of {formatMetric(open.targetValue, metric.unit)}
                {deadline !== null ? `, ${deadline} days left` : ""}
              </span>
            </div>
            <div className="mt-1.5">
              <Progress value={d.cards.current.value} max={open.targetValue} tone={deadline !== null && deadline < 14 ? "red" : "blue"} />
            </div>
          </>
        ) : (
          <div className="text-sm text-muted">{live ? "No open milestone." : `Ended ${formatDate(d.pairing.endedAt)}.`}</div>
        )}
        <div className="mt-1.5 text-xs text-muted tnum">
          {logged} weeks logged{gaps ? `, ${gaps} missed` : ""}. Vested {formatPct(d.cards.equity.vestedPct)} of {formatPct(d.cards.equity.onOfferPct)}.
          {live && viewer === "counterpart" ? (d.thisWeekEntry ? " This week logged." : " This week not logged yet.") : ""}
        </div>
      </div>
      <div className="flex gap-2 md:justify-end">
        {live && viewer === "counterpart" ? (
          <Link href={`/pairings/${d.pairing.id}/log`} className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium border ${d.thisWeekEntry ? "border-line-strong hover:bg-surface" : "bg-brand text-white border-brand hover:bg-brand-ink"}`}>
            {d.thisWeekEntry ? "Edit this week" : "Log this week"}
          </Link>
        ) : (
          <Link href={`/pairings/${d.pairing.id}`} className="inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium border border-line-strong hover:bg-surface">
            Open
          </Link>
        )}
      </div>
    </div>
  );
}

export function Inbox({ items }: { items: Notification[] }) {
  if (items.length === 0) return <p className="py-6 text-sm text-muted">Nothing yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((n) => (
        <li key={n.id} className="py-3 flex gap-3">
          <span className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-brand"}`} />
          <div className="min-w-0">
            <div className="text-sm">{n.href ? <Link href={n.href} className="hover:underline">{n.body}</Link> : n.body}</div>
            <div className="text-xs text-muted tnum">{formatDate(n.createdAt)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
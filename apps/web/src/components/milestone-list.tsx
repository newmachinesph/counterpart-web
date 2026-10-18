import type { Milestone, MilestoneStatus, VestingEntry } from "@/lib/domain/types";
import { formatDate, formatMetric, formatPct } from "@/lib/format";
import type { MetricDefinition } from "@/lib/domain/types";
import { Pill, type Tone } from "./ui";

export const STATUS_TONE: Record<MilestoneStatus, Tone> = {
  cleared: "green",
  open: "blue",
  locked: "gray",
  missed: "red",
};

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  cleared: "Cleared",
  open: "Open",
  locked: "Locked",
  missed: "Missed",
};

type Row = Milestone & { deadline?: string | null };

/**
 * Milestone schedule. On the Bench, every row is the offer (status hidden).
 * On a pairing dashboard, rows carry status, dates, and vesting.
 */
export function MilestoneList({
  milestones,
  metrics,
  vesting,
  showStatus = false,
}: {
  milestones: Row[];
  metrics: MetricDefinition[];
  vesting?: VestingEntry[];
  showStatus?: boolean;
}) {
  const metricByKey = new Map(metrics.map((m) => [m.key, m]));
  const vestedByMilestone = new Map((vesting ?? []).map((v) => [v.milestoneId, v]));

  return (
    <ol className="divide-y divide-line border-y border-line">
      {milestones.map((m) => {
        const metric = metricByKey.get(m.metricKey);
        const vested = vestedByMilestone.get(m.id);
        const target = metric ? formatMetric(m.targetValue, metric.unit) : m.targetValue;
        return (
          <li key={m.id} className="py-3 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex items-center gap-3 sm:w-28 shrink-0">
              <span className="text-xs text-muted tnum w-4">{m.sequence}</span>
              {showStatus ? <Pill tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Pill> : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{m.title}</div>
              <div className="text-sm text-muted tnum">
                {metric?.label ?? m.metricKey} reaches {target}, within {m.windowDays} days
                {m.isProvingRun ? ". Performance progress does not grant equity or automatically continue an engagement." : ""}
              </div>
              {showStatus ? <MilestoneDates m={m} vested={vested} /> : null}
            </div>
            <div className="sm:text-right shrink-0">
              <div className="text-lg font-medium tnum">{formatPct(m.tranchePct)}</div>
              <div className="text-xs text-muted">tranche</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MilestoneDates({ m, vested }: { m: Row; vested?: VestingEntry }) {
  if (m.status === "cleared") {
    return (
      <div className="text-sm text-green tnum">
        Cleared {formatDate(m.clearedAt)}
        {vested ? `. ${formatPct(vested.tranchePct)} vested.` : ""}
      </div>
    );
  }
  if (m.status === "open") {
    return (
      <div className="text-sm text-blue tnum">
        Opened {formatDate(m.openedAt)}
        {m.deadline ? `. Deadline ${formatDate(m.deadline)}.` : ""}
      </div>
    );
  }
  if (m.status === "missed") {
    return <div className="text-sm text-red tnum">Missed {formatDate(m.missedAt)}. Tranche voided.</div>;
  }
  return <div className="text-sm text-muted">Opens when the previous milestone settles.</div>;
}

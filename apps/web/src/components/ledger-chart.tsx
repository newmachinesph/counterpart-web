import type { LedgerEntry, MetricDefinition } from "@/lib/domain/types";
import { formatMetric, formatShortDate } from "@/lib/format";

interface Week {
  weekStarting: string;
  entry: LedgerEntry | null;
  closed: boolean;
}

/**
 * Weekly bars for one metric. Server-rendered, no chart library.
 * A missing week renders as a dashed empty slot: a gap is a signal.
 */
export function LedgerChart({
  weeks,
  metric,
  target,
}: {
  weeks: Week[];
  metric: MetricDefinition;
  target: number | null;
}) {
  const values = weeks.map((w) => (w.entry ? (w.entry.values[metric.key] ?? 0) : null));
  const max = Math.max(1, ...values.filter((v): v is number => v !== null));

  return (
    <div>
      <div className="flex items-end gap-1.5 sm:gap-2 h-40 border-b border-line">
        {weeks.map((w, i) => {
          const value = values[i];
          if (value === null) {
            return (
              <div key={w.weekStarting} className="flex-1 h-full flex flex-col justify-end" title="No entry">
                <div className="h-full rounded-t-sm border border-dashed border-line-strong" />
              </div>
            );
          }
          const pct = Math.max(2, Math.round((value / max) * 100));
          const tone = !w.closed ? "bg-blue" : "bg-fg";
          return (
            <div key={w.weekStarting} className="flex-1 h-full flex flex-col justify-end items-stretch" title={formatMetric(value, metric.unit)}>
              <div className="text-[10px] text-muted tnum text-center mb-1 truncate">
                {formatMetric(value, metric.unit)}
              </div>
              <div className={`rounded-t-sm ${tone}`} style={{ height: `${pct}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 sm:gap-2 mt-1.5">
        {weeks.map((w) => (
          <div key={w.weekStarting} className="flex-1 text-[10px] text-muted tnum text-center truncate">
            {formatShortDate(w.weekStarting)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>{metric.label} per week</span>
        {target !== null ? <span className="tnum">Target {formatMetric(target, metric.unit)}</span> : null}
        <span>Dashed: no entry that week</span>
        <span>Blue: week still open</span>
      </div>
    </div>
  );
}
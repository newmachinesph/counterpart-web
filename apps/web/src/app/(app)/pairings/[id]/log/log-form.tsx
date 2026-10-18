"use client";

import { useActionState } from "react";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/ui";
import type { LedgerEntry, MetricDefinition } from "@/lib/domain/types";
import { logWeekAction, type LogState } from "../actions";

const INITIAL: LogState = { errors: {}, formError: null };

export function LogForm({
  pairingId,
  weekStarting,
  metrics,
  existing,
}: {
  pairingId: string;
  weekStarting: string;
  metrics: MetricDefinition[];
  existing: LedgerEntry | null;
}) {
  const action = logWeekAction.bind(null, pairingId);
  const [state, formAction, pending] = useActionState<LogState, FormData>(action, INITIAL);
  const e = state.errors;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.formError ? <Notice tone="red">{state.formError}</Notice> : null}
      <input type="hidden" name="weekStarting" value={weekStarting} />

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <Field
            key={m.key}
            htmlFor={`value_${m.key}`}
            label={m.label}
            error={e[`values.${m.key}`]}
            hint={m.aggregation === "sum" ? "This week only. It adds up." : "Total as of this week."}
          >
            <input
              id={`value_${m.key}`}
              name={`value_${m.key}`}
              type="number"
              min={0}
              step={m.unit === "php" ? 1 : 1}
              inputMode="numeric"
              required
              defaultValue={existing?.values[m.key] ?? ""}
              className={`${INPUT_CLASS} text-2xl tnum`}
            />
          </Field>
        ))}
      </div>

      <Field htmlFor="note" label="Note" error={e.note} hint="What happened. Short.">
        <textarea id="note" name="note" rows={3} defaultValue={existing?.note ?? ""} className={INPUT_CLASS} />
      </Field>

      <Field htmlFor="evidenceLinks" label="Evidence links" error={e.evidenceLinks ?? nested(e, "evidenceLinks")} hint="Optional. One per line.">
        <textarea id="evidenceLinks" name="evidenceLinks" rows={2} defaultValue={existing?.evidenceLinks.join("\n") ?? ""} className={INPUT_CLASS} placeholder="https://" />
      </Field>

      <div className="border-t border-line pt-5 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : existing ? "Update this week" : "Log this week"}
        </Button>
        <span className="text-sm text-muted">Visible to the builder immediately.</span>
      </div>
    </form>
  );
}

function nested(errors: Record<string, string>, prefix: string): string | undefined {
  const key = Object.keys(errors).find((k) => k.startsWith(`${prefix}.`));
  return key ? errors[key] : undefined;
}
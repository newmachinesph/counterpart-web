"use client";

import { useActionState, useState } from "react";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/ui";
import { applyToJobAction } from "../../actions";
import { EMPTY, type FormState } from "../../form-state";

const MIN_EVIDENCE = 120;

export function ApplyJobForm({ openingId, paid }: { openingId: string; paid: boolean }) {
  const action = applyToJobAction.bind(null, openingId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, EMPTY);
  const [len, setLen] = useState(0);
  const e = state.errors;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.formError ? <Notice tone="red">{state.formError}</Notice> : null}

      <Field
        htmlFor="evidence"
        label="What have you done that is like this?"
        error={e.evidence}
        hint={<span className="tnum">{len} of at least {MIN_EVIDENCE} characters. What, for whom, how many, over what period.</span>}
      >
        <textarea id="evidence" name="evidence" rows={6} required minLength={MIN_EVIDENCE} className={INPUT_CLASS} onChange={(ev) => setLen(ev.target.value.trim().length)} />
      </Field>

      <Field htmlFor="proofLinks" label="Proof links" error={e.proofLinks ?? nested(e, "proofLinks")} hint="One per line. A page, a store, a campaign, a ledger. At least one.">
        <textarea id="proofLinks" name="proofLinks" rows={2} required className={INPUT_CLASS} placeholder="https://" />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field htmlFor="availableFrom" label="You can start" error={e.availableFrom}>
          <input id="availableFrom" name="availableFrom" type="date" required className={INPUT_CLASS} />
        </Field>
        {paid ? (
          <Field htmlFor="expectedSalaryPhpMonthly" label="Expected pay, PHP a month" error={e.expectedSalaryPhpMonthly} hint="Optional. Leave blank to take the posted range.">
            <input id="expectedSalaryPhpMonthly" name="expectedSalaryPhpMonthly" type="number" min={0} step={500} className={INPUT_CLASS} />
          </Field>
        ) : null}
      </div>

      <Field htmlFor="whyThisRole" label="Why this role" error={e.whyThisRole}>
        <textarea id="whyThisRole" name="whyThisRole" rows={3} required className={INPUT_CLASS} />
      </Field>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={pending}>{pending ? "Sending" : "Send application"}</Button>
        <span className="text-sm text-muted">They reply either way.</span>
      </div>
    </form>
  );
}

function nested(errors: Record<string, string>, prefix: string): string | undefined {
  const key = Object.keys(errors).find((k) => k.startsWith(`${prefix}.`));
  return key ? errors[key] : undefined;
}
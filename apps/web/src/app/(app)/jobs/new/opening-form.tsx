"use client";

import { useActionState, useState } from "react";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/ui";
import { ARRANGEMENT_LABELS, FUNDING_LABELS, OPENING_TYPE_LABELS } from "@/lib/domain/openings";
import { FUNDING_SOURCES, OPENING_TYPES, WORK_ARRANGEMENTS } from "@/lib/domain/types";
import { postOpeningAction } from "../actions";
import { EMPTY, type FormState } from "../form-state";

export interface PostableVenture {
  id: string;
  name: string;
  ledgerRevenuePhp: number;
}

export function OpeningForm({ ventures, canPostForCounterpart }: { ventures: PostableVenture[]; canPostForCounterpart: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(postOpeningAction, EMPTY);
  const [ventureId, setVentureId] = useState(canPostForCounterpart ? "" : (ventures[0]?.id ?? ""));
  const [fundedBy, setFundedBy] = useState<string>("outside_funding");
  const selected = ventures.find((v) => v.id === ventureId) ?? null;
  const paid = fundedBy === "ledger_revenue" || fundedBy === "outside_funding";
  const e = state.errors;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.formError ? <Notice tone="red">{state.formError}</Notice> : null}

      <Field htmlFor="ventureId" label="Hiring for" error={e.ventureId}>
        <select id="ventureId" name="ventureId" value={ventureId} onChange={(ev) => setVentureId(ev.target.value)} className={INPUT_CLASS}>
          {canPostForCounterpart ? <option value="">Counterpart itself</option> : null}
          {ventures.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field htmlFor="title" label="Title" error={e.title}>
          <input id="title" name="title" required className={INPUT_CLASS} placeholder="Field sales representative" />
        </Field>
        <Field htmlFor="team" label="Team" error={e.team}>
          <input id="team" name="team" required className={INPUT_CLASS} placeholder="Field sales" />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field htmlFor="type" label="Type" error={e.type}>
          <select id="type" name="type" className={INPUT_CLASS} defaultValue="full_time">
            {OPENING_TYPES.map((t) => <option key={t} value={t}>{OPENING_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field htmlFor="arrangement" label="Arrangement" error={e.arrangement}>
          <select id="arrangement" name="arrangement" className={INPUT_CLASS} defaultValue="onsite">
            {WORK_ARRANGEMENTS.map((a) => <option key={a} value={a}>{ARRANGEMENT_LABELS[a]}</option>)}
          </select>
        </Field>
        <Field htmlFor="location" label="Location" error={e.location}>
          <input id="location" name="location" required className={INPUT_CLASS} placeholder="Quezon City" />
        </Field>
      </div>

      <Field htmlFor="summary" label="What the role is" error={e.summary}>
        <textarea id="summary" name="summary" rows={3} required className={INPUT_CLASS} />
      </Field>
      <Field htmlFor="responsibilities" label="What they would do" error={e.responsibilities ?? nested(e, "responsibilities")} hint="One per line.">
        <textarea id="responsibilities" name="responsibilities" rows={3} required className={INPUT_CLASS} />
      </Field>
      <Field htmlFor="lookingFor" label="What you are looking for" error={e.lookingFor ?? nested(e, "lookingFor")} hint="One per line. Evidence, not credentials. Never a degree or an employer.">
        <textarea id="lookingFor" name="lookingFor" rows={3} required className={INPUT_CLASS} />
      </Field>

      <div className="rounded-xl border border-line p-4 flex flex-col gap-4">
        <Field htmlFor="fundedBy" label="Where the money comes from" error={e.fundedBy}>
          <select id="fundedBy" name="fundedBy" value={fundedBy} onChange={(ev) => setFundedBy(ev.target.value)} className={INPUT_CLASS}>
            {FUNDING_SOURCES.filter((f) => (f === "outside_funding" || f === "ledger_revenue") && (ventureId !== "" || f !== "ledger_revenue")).map((f) => (
              <option key={f} value={f}>{FUNDING_LABELS[f]}</option>
            ))}
          </select>
        </Field>
        {fundedBy === "ledger_revenue" ? (
          <Notice tone={selected && selected.ledgerRevenuePhp > 0 ? "green" : "red"}>
            {selected && selected.ledgerRevenuePhp > 0
              ? `${selected.name}'s ledger recorded ₱${selected.ledgerRevenuePhp.toLocaleString("en-PH")} in the last four weeks. The top of your range cannot exceed that.`
              : "This venture's ledger has no revenue in the last four weeks. Fund the role another way, or log the revenue first."}
          </Notice>
        ) : null}
        {paid ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field htmlFor="salaryMinPhpMonthly" label="Pay from, PHP a month" error={e.salaryMinPhpMonthly}>
              <input id="salaryMinPhpMonthly" name="salaryMinPhpMonthly" type="number" min={0} step={500} className={INPUT_CLASS} />
            </Field>
            <Field htmlFor="salaryMaxPhpMonthly" label="Pay to, PHP a month" error={e.salaryMaxPhpMonthly}>
              <input id="salaryMaxPhpMonthly" name="salaryMaxPhpMonthly" type="number" min={0} step={500} className={INPUT_CLASS} />
            </Field>
          </div>
        ) : null}
        <Field htmlFor="compensationDetails" label="Employer and working terms" error={e.compensationDetails} hint="Identify the employer, exact pay schedule, hours, benefits, expenses and applicable working arrangement. Statutory rights still apply.">
          <textarea id="compensationDetails" name="compensationDetails" required minLength={80} rows={5} className={INPUT_CLASS} />
        </Field>
      </div>

      <div className="border-t border-line pt-5">
        <Button type="submit" disabled={pending}>{pending ? "Posting" : "Post the role"}</Button>
      </div>
    </form>
  );
}

function nested(errors: Record<string, string>, prefix: string): string | undefined {
  const key = Object.keys(errors).find((k) => k.startsWith(`${prefix}.`));
  return key ? errors[key] : undefined;
}
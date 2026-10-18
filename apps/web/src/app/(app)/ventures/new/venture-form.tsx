"use client";

import { useActionState, useState } from "react";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/ui";
import { VENTURE_CATEGORIES, VENTURE_STAGES } from "@/lib/domain/types";
import { CATEGORY_LABELS, STAGE_LABELS } from "@/lib/format";
import { createVentureAction, type VentureFormState } from "../actions";
import { CommercialTermsFields } from "@/components/commercial-terms-fields";
import { ScreenshotUpload } from "@/components/screenshot-upload";

const INITIAL: VentureFormState = { errors: {}, formError: null };

const DEFAULT_MILESTONES = [
  { title: "Proving run: first customers", metricKey: "customers_live", metricLabel: "Customers live", unit: "count", aggregation: "latest", targetValue: 3, tranchePct: 0, windowDays: 45 },
  { title: "First revenue", metricKey: "revenue_php", metricLabel: "Revenue", unit: "php", aggregation: "sum", targetValue: 25000, tranchePct: 0, windowDays: 90 },
];

export function VentureForm() {
  const [state, formAction, pending] = useActionState<VentureFormState, FormData>(createVentureAction, INITIAL);
  const [rows, setRows] = useState(DEFAULT_MILESTONES.length);
  const [productUrl, setProductUrl] = useState("");
  const e = state.errors;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.formError ? <Notice tone="red">{state.formError}</Notice> : null}

      <Field htmlFor="name" label="Name" error={e.name}>
        <input id="name" name="name" required className={INPUT_CLASS} />
      </Field>
      <Field htmlFor="oneLiner" label="One line" error={e.oneLiner} hint="What it does, for whom. Under 140 characters.">
        <input id="oneLiner" name="oneLiner" required maxLength={140} className={INPUT_CLASS} />
      </Field>
      <Field htmlFor="description" label="What works today" error={e.description}>
        <textarea id="description" name="description" rows={5} required className={INPUT_CLASS} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field htmlFor="category" label="Category" error={e.category}>
          <select id="category" name="category" className={INPUT_CLASS} defaultValue="saas">
            {VENTURE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
        <Field htmlFor="stage" label="Stage" error={e.stage}>
          <select id="stage" name="stage" className={INPUT_CLASS} defaultValue="live">
            {VENTURE_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field htmlFor="productUrl" label="Live product URL" error={e.productUrl} hint="Publishing fetches this. If it does not answer, the venture stays a draft.">
        <input id="productUrl" name="productUrl" type="url" required placeholder="https://" className={INPUT_CLASS} onBlur={event => setProductUrl(event.target.value)} />
      </Field>
      <ScreenshotUpload productUrl={productUrl} error={e.screenshots ?? nested(e, "screenshots")} />
      <Field htmlFor="tractionSummary" label="Current traction, one line" error={e.tractionSummary} hint="Real numbers. Example: 7 merchants live, PHP 19,500 revenue.">
        <input id="tractionSummary" name="tractionSummary" required className={INPUT_CLASS} />
      </Field>

      <CommercialTermsFields errors={e} />
      <input type="hidden" name="equityMinPct" value="0" /><input type="hidden" name="equityMaxPct" value="0" />
      <div>
        <Field htmlFor="hoursPerWeek" label="Hours per week" error={e.hoursPerWeek}>
          <input id="hoursPerWeek" name="hoursPerWeek" type="number" min={1} max={80} required className={INPUT_CLASS} defaultValue={20} />
        </Field>
      </div>

      <Field htmlFor="builderHasDone" label="What you have already done" error={e.builderHasDone} hint="One per line.">
        <textarea id="builderHasDone" name="builderHasDone" rows={3} required className={INPUT_CLASS} />
      </Field>
      <Field htmlFor="counterpartWouldOwn" label="Responsibilities and access you will provide" error={e.counterpartWouldOwn} hint="One per line.">
        <textarea id="counterpartWouldOwn" name="counterpartWouldOwn" rows={3} required className={INPUT_CLASS} />
      </Field>
      <input type="hidden" name="vestingTerms" value="Cash compensation only. Any cofounder equity requires a separate documented agreement." />

      <div className="rounded-xl border border-line p-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 text-sm text-muted">Contribution estimate: revenue less variable costs. This excludes overhead and salaries and is not net profit or verified available cash.</div>
        <Field htmlFor="unitLabel" label="Unit" error={e.unitLabel} hint="merchant, seller, driver, cooperative">
          <input id="unitLabel" name="unitLabel" required className={INPUT_CLASS} defaultValue="customer" />
        </Field>
        <Field htmlFor="revenuePerUnitPhpMonthly" label="Revenue per unit, PHP a month" error={e.revenuePerUnitPhpMonthly}>
          <input id="revenuePerUnitPhpMonthly" name="revenuePerUnitPhpMonthly" type="number" min={0} required className={INPUT_CLASS} defaultValue={499} />
        </Field>
        <Field htmlFor="variableCostPerUnitPhpMonthly" label="Variable cost per unit, PHP a month" error={e.variableCostPerUnitPhpMonthly}>
          <input id="variableCostPerUnitPhpMonthly" name="variableCostPerUnitPhpMonthly" type="number" min={0} required className={INPUT_CLASS} defaultValue={50} />
        </Field>
        <Field htmlFor="monthlyContributionPhp" label="Target contribution, PHP a month" error={e.monthlyContributionPhp}>
          <input id="monthlyContributionPhp" name="monthlyContributionPhp" type="number" min={1} required className={INPUT_CLASS} defaultValue={30000} />
        </Field>
        <Field htmlFor="withinDays" label="Within, days" error={e.withinDays}>
          <input id="withinDays" name="withinDays" type="number" min={30} required className={INPUT_CLASS} defaultValue={270} />
        </Field>

      </div>

      <fieldset className="flex flex-col gap-3">        <legend className="text-sm font-medium">Milestones, in order</legend>
        <p className="text-sm text-muted">
          These are performance goals, not equity awards. Match the first window to the paid trial duration. Metric key is the ledger field name. Sum for flows like revenue, latest for stocks like customers live.
        </p>
        {e.milestones || nested(e, "milestones") ? (
          <p className="text-sm text-red">{e.milestones ?? nested(e, "milestones")}</p>
        ) : null}
        {Array.from({ length: rows }).map((_, i) => {
          const d = DEFAULT_MILESTONES[i];
          return (
            <div key={i} className="rounded-md border border-line p-3 grid gap-2 sm:grid-cols-4">
              <input name="ms_title" placeholder="Title" defaultValue={d?.title} className={`${INPUT_CLASS} sm:col-span-2`} aria-label="Milestone title" />
              <input name="ms_metricKey" placeholder="metric_key" defaultValue={d?.metricKey} className={INPUT_CLASS} aria-label="Metric key" />
              <input name="ms_metricLabel" placeholder="Metric label" defaultValue={d?.metricLabel} className={INPUT_CLASS} aria-label="Metric label" />
              <select name="ms_unit" defaultValue={d?.unit ?? "count"} className={INPUT_CLASS} aria-label="Unit">
                <option value="count">Count</option>
                <option value="php">PHP</option>
              </select>
              <select name="ms_aggregation" defaultValue={d?.aggregation ?? "latest"} className={INPUT_CLASS} aria-label="Aggregation">
                <option value="latest">Latest week</option>
                <option value="sum">Cumulative sum</option>
              </select>
              <input name="ms_targetValue" type="number" min={0} step="any" placeholder="Target" defaultValue={d?.targetValue} className={INPUT_CLASS} aria-label="Target" />
              <div className="grid grid-cols-2 gap-2">
                <input name="ms_tranchePct" type="hidden" value="0" />
                <input name="ms_windowDays" type="number" min={1} placeholder="Days" defaultValue={d?.windowDays} className={INPUT_CLASS} aria-label="Window days" />
              </div>
            </div>
          );
        })}
        <div>
          <button type="button" className="text-sm underline text-muted hover:text-fg" onClick={() => setRows((n) => Math.min(n + 1, 8))}>
            Add a milestone
          </button>
        </div>
      </fieldset>

      <div className="border-t border-line pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save as draft"}
        </Button>
      </div>
    </form>
  );
}

function nested(errors: Record<string, string>, prefix: string): string | undefined {
  const key = Object.keys(errors).find((k) => k.startsWith(`${prefix}.`));
  return key ? errors[key] : undefined;
}

"use client";

import { useState } from "react";
import type { TermsTemplate } from "@/lib/domain/types";
import { AGREEMENT_FIELDS, agreementText, templateVariables, type AgreementValues } from "@/lib/domain/agreement-template";
import { Button, INPUT_CLASS, Notice, PageHeader } from "./ui";

type Field = { key: string; label: string; group: string; example?: string; type?: string; multiline?: boolean; min?: number; max?: number; step?: number; unit?: string };

export function AgreementEditor({ terms }: { terms: TermsTemplate }) {
  const [values, setValues] = useState<AgreementValues>({});
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [message, setMessage] = useState("");
  const keys = templateVariables(terms);
  const fields: Field[] = keys.map((key) => AGREEMENT_FIELDS.find((field) => field.key === key) ?? {
    key, label: key.toLowerCase().replaceAll("_", " "), group: "Other variables",
  });
  const groups = [...new Set(fields.map((field) => field.group))];
  const completed = keys.filter((key) => values[key]?.trim()).length;
  const errors = Object.fromEntries(fields.flatMap((field) => {
    const value = values[field.key];
    if (field.type !== "number" || !value) return [];
    const number = Number(value);
    const invalid = !Number.isFinite(number) || (field.min !== undefined && number < field.min)
      || (field.max !== undefined && number > field.max) || (field.step === 1 && !Number.isInteger(number));
    return invalid ? [[field.key, `Enter ${field.step === 1 ? "a whole number" : "a number"} from ${field.min ?? 0}${field.max !== undefined ? ` to ${field.max}` : " or higher"}.`]] : [];
  }));
  const hasErrors = Object.keys(errors).length > 0;

  function renderText(text: string) {
    return text.split(/(\[[A-Z][A-Z0-9_]*\])/g).map((part, index) => {
      if (!/^\[[A-Z][A-Z0-9_]*\]$/.test(part)) return part;
      const key = part.slice(1, -1);
      const value = values[key]?.trim();
      return <button key={index} type="button" title={`Edit ${key}`} onClick={() => {
        const input = document.getElementById(`variable-${key}`);
        input?.scrollIntoView({ behavior: "auto", block: "center" });
        input?.focus({ preventScroll: true });
      }} className={`inline rounded px-1 text-left break-words underline decoration-dotted underline-offset-4 ${value ? "bg-brand-soft text-brand-ink" : "bg-mango-soft text-fg"}`}>
        {showPlaceholders || !value ? part : value}
      </button>;
    });
  }

  function download() {
    const url = URL.createObjectURL(new Blob([agreementText(terms, values)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${terms.id}-draft.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Draft downloaded with your current values.");
  }

  return <div>
    <PageHeader title={terms.title} description="Shape the terms together. Edit a variable and see it change throughout the agreement." aside={<span className="rounded-full border border-line px-3 py-1 text-xs text-muted">Draft template · {terms.id}</span>} />
    <Notice>{terms.reviewNote}</Notice>

    <section aria-label="Agreement overview" className="my-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
      <div className="bg-surface p-5"><p className="text-xs uppercase tracking-wider text-muted">Paid trial</p><p className="mt-2 text-3xl tnum">{values.TRIAL_DAYS || "—"} <span className="text-base text-muted">days</span></p><p className="mt-2 text-sm text-muted">Both parties accept before work starts</p></div>
      <div className="bg-surface p-5"><p className="text-xs uppercase tracking-wider text-muted">Cash compensation</p><p className="mt-2 text-3xl tnum">{values.COMMISSION_RATE_PCT || "—"}<span className="text-base text-muted">% commission</span></p><p className="mt-2 text-sm text-muted">Monthly fee: PHP {values.MONTHLY_FEE_PHP || "—"}</p></div>
      <div className="bg-surface p-5"><p className="text-xs uppercase tracking-wider text-muted">Registered pipeline</p><p className="mt-2 text-3xl tnum">{values.TAIL_DAYS || "—"} <span className="text-base text-muted">days after exit</span></p><p className="mt-2 text-sm text-muted">Accrued compensation survives. Equity requires a separate instrument.</p></div>
    </section>

    <div className="grid items-start gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside aria-label="Edit agreement variables" className="max-h-[65dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-4 sm:p-5 lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)]">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg">Your variables</h2><span className="text-xs text-muted tnum" aria-live="polite">{completed}/{keys.length} filled</span></div>
        <p className="mt-2 text-sm text-muted">Preview only. Values stay here until you leave or reload. Download a draft to keep them.</p>
        <div className="my-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setValues(Object.fromEntries(fields.map((field) => [field.key, field.example ?? ""]))); setMessage("Fictional examples loaded. Replace them with your agreed terms."); }}>Use examples</Button>
          <Button variant="secondary" disabled={completed === 0} onClick={() => { setValues({}); setMessage("All variables cleared."); }}>Clear</Button>
        </div>
        {groups.map((group) => <fieldset key={group} className="mt-6 min-w-0 border-t border-line pt-4">
          <legend className="pr-2 text-xs font-medium uppercase tracking-wide text-muted">{group}</legend>
          <div className="space-y-4">{fields.filter((field) => field.group === group).map((field) => <div key={field.key}>
            <label htmlFor={`variable-${field.key}`} className="mb-1.5 block text-sm">{field.label}{field.unit && <span className="text-muted"> ({field.unit})</span>}</label>
            {field.multiline ? <textarea id={`variable-${field.key}`} rows={3} className={`${INPUT_CLASS} resize-y`} value={values[field.key] ?? ""} onChange={(event) => { setValues({ ...values, [field.key]: event.target.value }); setMessage(""); }} />
              : <input id={`variable-${field.key}`} type={field.type ?? "text"} min={field.min} max={field.max} step={field.step} aria-invalid={Boolean(errors[field.key])} aria-describedby={errors[field.key] ? `error-${field.key}` : undefined} className={INPUT_CLASS} value={values[field.key] ?? ""} onChange={(event) => {
                setValues({ ...values, [field.key]: event.target.value }); setMessage("");
              }} />}
            {errors[field.key] && <p id={`error-${field.key}`} className="mt-1 text-xs text-red">{errors[field.key]}</p>}
            <p className="mt-1 break-all font-mono text-[10px] text-muted">[{field.key}]</p>
          </div>)}</div>
        </fieldset>)}
      </aside>

      <section aria-label="Agreement preview" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg">Live agreement preview</h2><p className="text-xs text-muted">Select any highlighted term to edit it.</p></div>
          <Button variant="secondary" disabled={hasErrors} onClick={download}>Download draft</Button>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <p>{hasErrors ? "Correct the highlighted fields before downloading." : keys.length - completed ? `${keys.length - completed} variables still to complete` : "All variables filled · ready for counsel’s review"}</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showPlaceholders} onChange={(event) => setShowPlaceholders(event.target.checked)} className="accent-brand" />Show variable names</label>
        </div>
        <p role="status" className="mb-3 text-sm text-brand-ink">{message}</p>
        <article className="rounded-2xl border border-line bg-bg p-5 sm:p-8">
          <div className="mb-8 border-b border-line pb-6"><p className="text-xs uppercase tracking-widest text-muted">Counterpart / draft agreement</p><h3 className="mt-3 font-display text-3xl leading-tight">{values.VENTURE_NAME || "Your venture"}</h3><p className="mt-2 text-sm text-muted">{values.BUILDER_NAME || "Builder"} & {values.COUNTERPART_NAME || "Counterpart"}</p></div>
          <ol className="space-y-7">{terms.sections.map((section, index) => <li key={section.heading}>
            <h3 className="mb-2 font-medium"><span className="mr-2 text-muted tnum">{index + 1}.</span>{renderText(section.heading)}</h3>
            <p className="whitespace-pre-line text-sm leading-7 text-muted [overflow-wrap:anywhere]">{renderText(section.body)}</p>
          </li>)}</ol>
          <p className="mt-8 border-t border-line pt-5 text-xs text-muted">Draft only · {terms.id} · {terms.reviewNote}</p>
        </article>
      </section>
    </div>
  </div>;
}

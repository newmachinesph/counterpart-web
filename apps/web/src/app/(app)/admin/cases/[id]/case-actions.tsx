"use client";
import { useActionState } from "react";
import { Button, Field, INPUT_CLASS } from "@/components/ui";
import type { OperationsCase, OperationsFormState, OperationsOverview } from "@/lib/operations";
import { updateCase } from "./actions";

export function CaseActions({ row, admins }: { row: OperationsCase; admins: OperationsOverview["admins"] }) {
  const [state, action, pending] = useActionState<OperationsFormState, FormData>(updateCase.bind(null, row.id, row.version), {});
  const closed = row.status === "resolved";
  const moderation = row.events?.filter(event => ["hide_listing", "restore_listing"].includes(event.action)).at(-1);
  return <form action={action} className="space-y-5">
    {!closed && <div className="space-y-3"><Field label="Responsible administrator" htmlFor="assignedTo"><select id="assignedTo" name="assignedTo" defaultValue={row.assignedTo ?? ""} key={row.assignedTo ?? "none"} className={INPUT_CLASS}><option value="">Unassigned</option>{admins.map(admin => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></Field><Button variant="secondary" name="action" value="assign" disabled={pending}>Save owner</Button></div>}
    <Field label={closed ? "Reason to reopen" : "Note or outcome"} htmlFor="note" hint="Notes stay internal. A resolution is visible to the requester and, for disputes, both parties. Resolutions and moderation reasons need at least 20 characters."><textarea id="note" name="note" rows={5} maxLength={3000} className={INPUT_CLASS} /></Field>
    <div className="flex flex-wrap gap-2">
      {closed ? <Button name="action" value="reopen" disabled={pending}>Reopen case</Button> : <>
        <Button variant="secondary" name="action" value="note" disabled={pending}>Add internal note</Button>
        {row.status === "open" && <Button variant="secondary" name="action" value="start" disabled={pending}>Start review</Button>}
        <Button name="action" value="resolve" disabled={pending}>Record resolution</Button>
      </>}
    </div>
    {!closed && row.category === "listing" && row.venture && <div className="border-t border-line pt-5">
      <p className="mb-3 text-sm text-muted">Hiding a listing removes it from the Bench and closes applications. Existing engagement records are preserved.</p>
      {row.venture.status !== "draft" ? <Button variant="danger" name="action" value="hide_listing" disabled={pending}>Hide listing</Button> : moderation?.action === "hide_listing" ? <Button variant="secondary" name="action" value="restore_listing" disabled={pending}>Restore listing</Button> : <p className="text-sm text-muted">This listing is already hidden.</p>}
    </div>}
    {state.error && <p role="alert" className="text-sm text-red">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green">{state.success}</p>}
    {pending && <p role="status" className="text-sm text-muted">Saving update…</p>}
  </form>;
}

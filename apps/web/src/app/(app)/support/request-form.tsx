"use client";
import { useActionState, useState } from "react";
import { Button, Field, INPUT_CLASS } from "@/components/ui";
import type { OperationsFormState } from "@/lib/operations";
import { submitRequest } from "./actions";

export function RequestForm({ initialCategory, ventureSlug }: { initialCategory: string; ventureSlug: string }) {
  const [category, setCategory] = useState(initialCategory);
  const [state, action, pending] = useActionState<OperationsFormState, FormData>(submitRequest, {});
  return <form action={action} className="space-y-5">
    <Field label="What do you need help with?" htmlFor="category"><select id="category" name="category" value={category} onChange={event => setCategory(event.target.value)} className={INPUT_CLASS}><option value="support">General support</option><option value="listing">Report a listing</option><option value="account">Account or privacy request</option></select></Field>
    {category === "listing" && <Field label="Venture page name" htmlFor="ventureSlug" hint="The last part of its Bench URL, for example creatorz in /bench/creatorz."><input id="ventureSlug" name="ventureSlug" defaultValue={ventureSlug} maxLength={80} required className={INPUT_CLASS} /></Field>}
    <Field label="Subject" htmlFor="subject"><input id="subject" name="subject" minLength={5} maxLength={160} required className={INPUT_CLASS} /></Field>
    <Field label="Tell us what happened" htmlFor="message" hint="Include relevant details and what you need us to do. Do not include passwords or identity documents."><textarea id="message" name="message" minLength={20} maxLength={5000} rows={6} required className={INPUT_CLASS} /></Field>
    {category === "account" && <p className="text-sm text-muted">Account closure and data requests are reviewed by an administrator. Submitting a request does not immediately delete your account or engagement records.</p>}
    {state.error && <p role="alert" className="text-sm text-red">{state.error}</p>}
    <Button disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
  </form>;
}

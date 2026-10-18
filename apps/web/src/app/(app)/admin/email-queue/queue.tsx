"use client";
import { useCallback, useEffect, useState } from "react";
import { platform } from "@/lib/api/browser";
import { Button, Field, INPUT_CLASS } from "@/components/ui";

type Job = {id: string; to: string; subject: string; status: string; attempts: number; send_at: string | null; last_error: string | null};
export function EmailQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => platform<Job[]>("admin/email-queue").then(setJobs).catch(err => setError(err.message)), []);
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, [refresh]);
  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
    <form className="flex flex-col gap-4" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setBusy(true); setError("");
      try { await platform("admin/email-queue", { to: values.get("to"), subject: values.get("subject"), body: values.get("body"), send_at: values.get("sendAt") ? new Date(String(values.get("sendAt"))).toISOString() : null }); form.reset(); await refresh(); }
      catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      <Field label="Recipient" htmlFor="to"><input id="to" name="to" type="email" required className={INPUT_CLASS} /></Field>
      <Field label="Subject" htmlFor="subject"><input id="subject" name="subject" maxLength={200} required className={INPUT_CLASS} /></Field>
      <Field label="Message" htmlFor="body"><textarea id="body" name="body" rows={6} required className={INPUT_CLASS} /></Field>
      <Field label="Send at (your local time)" htmlFor="sendAt" hint="Leave blank to send as soon as a worker is available."><input id="sendAt" name="sendAt" type="datetime-local" className={INPUT_CLASS} /></Field>
      <Button disabled={busy}>{busy ? "Queuing…" : "Queue email"}</Button>
      {error && <p role="alert" className="text-red text-sm">{error}</p>}
    </form>
    <section aria-label="Recent email jobs" className="flex flex-col gap-3">
      <p className="text-sm text-muted">Failed deliveries retry up to 10 attempts with increasing delays. Only undelivered messages can be retried or cancelled.</p>
      {jobs.length === 0 && <p>No queued emails yet.</p>}
      {jobs.map(job => <article key={job.id} className="rounded-xl border border-line p-4 break-words">
        <h2 className="font-medium">{job.subject}</h2><p className="text-sm text-muted">{job.to}</p>
        <p className="mt-2 text-sm">{job.status} · {job.attempts} attempts{job.send_at ? ` · ${new Date(job.send_at).toLocaleString()}` : ""}</p>
        {job.last_error && <p className="text-red text-xs mt-1">{job.last_error}</p>}
        {job.status !== "delivered" && <div className="flex gap-2 mt-3">{["failed", "cancelled"].includes(job.status) && <Button variant="secondary" onClick={async () => { try { await platform(`admin/email-queue/${job.id}/retry`, {}); await refresh(); } catch (err) { setError((err as Error).message); } }}>Retry now</Button>}{job.status !== "cancelled" && <Button variant="secondary" onClick={async () => { try { await platform(`admin/email-queue/${job.id}/cancel`, {}); await refresh(); } catch (err) { setError((err as Error).message); } }}>Cancel</Button>}</div>}
      </article>)}
    </section>
  </div>;
}

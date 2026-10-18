"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { platform } from "@/lib/api/browser";

export function VerificationCard({ configured, status }: { configured: boolean; status: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function start() {
    setBusy(true); setError("");
    try {
      const session = await platform<{url: string; status: string}>("verification/start", {});
      if (session.status === "Approved") { router.refresh(); return; }
      const url = new URL(session.url);
      if (url.protocol !== "https:" || !(url.hostname === "didit.me" || url.hostname.endsWith(".didit.me"))) throw new Error("Verification link is unavailable.");
      window.location.assign(url.href);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <Card className="max-w-2xl"><div className="text-xs uppercase tracking-widest text-muted">Optional</div><h2 className="display text-3xl mt-2">Identity verification</h2>
    <p className="text-muted mt-3">You can use Counterpart without verifying your identity. If you choose to verify, Didit will handle your identity check. Counterpart stores the result and session reference, not your identity documents.</p>
    <p className="mt-4 font-medium">{status ? `Status: ${status}` : "Not verified"}</p>
    {!configured && <p className="mt-2 text-sm text-muted">Verification is not available yet. This does not restrict your account.</p>}
    {error && <p role="alert" className="mt-3 text-red">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-3">{configured && status !== "Approved" && <Button disabled={busy} onClick={start}>{busy ? "Opening…" : status && ["Not Started", "In Progress", "In Review", "Resubmitted"].includes(status) ? "Continue with Didit" : "Verify with Didit"}</Button>}<Button variant="secondary" onClick={() => router.refresh()}>Refresh status</Button></div>
    <a href="https://didit.me/privacy-policy" target="_blank" rel="noreferrer" className="inline-block mt-4 text-sm underline text-muted">Didit privacy policy</a>
  </Card>;
}

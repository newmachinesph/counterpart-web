"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Realtime, type TokenDetails } from "ably";
import { platform } from "@/lib/api/browser";
import { catchUpChat, type ChatMessage as Message, type ChatPage as Page } from "@/lib/api/chat-history";
import { Button, INPUT_CLASS } from "./ui";

export function PairingChat({ pairingId, userId }: { pairingId: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState("Connecting…");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const draftId = useRef<string | null>(null);
  const history = useRef<Message[] | null>(null);
  const updates = useRef<Promise<unknown>>(Promise.resolve());
  const refresh = useCallback(async (before?: string) => {
    const update = updates.current.catch(() => {}).then(async () => {
      const load = (cursor?: string) => platform<Page>(`pairings/${pairingId}/messages${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`);
      const initial = history.current === null;
      const page = before ? await load(before) : await catchUpChat(load, initial ? null : new Set(history.current!.map(message => message.id)));
      history.current = Array.from(new Map([...(history.current ?? []), ...page.messages].map(message => [message.id, message])).values())
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      setMessages(history.current);
      setReadOnly(page.read_only);
      setReady(true);
      if (before || initial) setCursor(page.next_before);
      return page;
    });
    updates.current = update;
    return update;
  }, [pairingId]);
  useEffect(() => {
    let disposed = false;
    let client: Realtime | undefined;
    const update = () => { void refresh().catch(err => setError(err.message)); };
    update();
    const poll = setInterval(update, 10000);
    platform<{ token_details: TokenDetails; channels: string[] }>("realtime/token", { pairing_id: pairingId }).then(data => {
      if (disposed) return;
      client = new Realtime({ tokenDetails: data.token_details, authCallback: async (_, done) => {
        try { done(null, (await platform<{token_details: TokenDetails}>("realtime/token", { pairing_id: pairingId })).token_details); }
        catch { done("Live chat unavailable", null); }
      } });
      client.connection.on(change => { setConnection(change.current === "connected" ? "Live" : "Reconnecting · checking every 10 seconds"); if (change.current === "connected") update(); });
      void client.channels.get(data.channels[1]).subscribe("message.created", update);
    }).catch(() => setConnection("Checking for messages every 10 seconds"));
    return () => { disposed = true; clearInterval(poll); client?.close(); };
  }, [pairingId, refresh]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true); setError("");
    draftId.current ??= crypto.randomUUID();
    try {
      await platform(`pairings/${pairingId}/messages`, { body, client_id: draftId.current });
      setBody(""); draftId.current = null;
      await refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setSending(false); }
  }
  return <section className="max-w-3xl rounded-2xl border border-line overflow-hidden">
    <div className="px-5 py-4 border-b border-line flex flex-wrap justify-between gap-2 text-sm"><span>Private to both parties and administrators</span><span className="text-muted" role="status">{connection}</span></div>
    <div className="p-5 flex flex-col gap-4 min-h-64 max-h-[60vh] overflow-y-auto" role="log" aria-label="Pairing conversation" aria-live="polite">
      {cursor && <Button variant="secondary" onClick={() => void refresh(cursor).catch(err => setError(err.message))}>Load earlier messages</Button>}
      {!ready ? <p className="text-muted">Loading conversation…</p> : messages.length === 0 ? <p className="text-muted">Start with a hello, a question, or your next step together.</p> : null}
      {messages.map(message => <article key={message.id} className={`rounded-2xl p-4 max-w-[90%] ${message.author_id === userId ? "self-end bg-brand/10" : "self-start bg-surface"}`}>
        <div className="text-xs text-muted mb-1">{message.author_name} · <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></div>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
      </article>)}
    </div>
    {error && <p role="alert" className="px-5 py-3 text-red text-sm">{error}</p>}
    {readOnly ? <p className="p-5 border-t border-line text-muted">This pairing has ended. Its conversation remains available to read.</p> : <form onSubmit={send} className="border-t border-line p-5 flex flex-col gap-3">
      <label htmlFor="message" className="text-sm font-medium">Message</label>
      <textarea id="message" value={body} onChange={event => { setBody(event.target.value); draftId.current = null; }} maxLength={4000} rows={3} className={INPUT_CLASS} disabled={sending || !ready} required />
      <div className="flex justify-end"><Button disabled={sending || !ready || !body.trim()}>{sending ? "Sending…" : "Send message"}</Button></div>
    </form>}
  </section>;
}

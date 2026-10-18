export type ChatMessage = { id: string; author_id: string; author_name: string; body: string; created_at: string; client_id: string };
export type ChatPage = { messages: ChatMessage[]; read_only: boolean; has_more: boolean; next_before: string | null; channel: string };

// After reconnecting, walk backwards until we reach the history already on screen.
// A single latest-page fetch can silently skip messages after a long disconnect.
export async function catchUpChat(load: (before?: string) => Promise<ChatPage>, known: Set<string> | null): Promise<ChatPage> {
  const latest = await load();
  let page = latest;
  const messages = [...latest.messages];
  while (known !== null && page.next_before && !page.messages.some(message => known.has(message.id))) {
    page = await load(page.next_before);
    messages.push(...page.messages);
  }
  return { ...latest, messages };
}

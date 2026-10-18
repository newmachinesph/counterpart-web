import { describe, expect, it } from "vitest";
import { catchUpChat, type ChatMessage, type ChatPage } from "./chat-history";

function page(ids: string[], cursor: string | null): ChatPage {
  return { messages: ids.map(id => ({ id } as ChatMessage)), next_before: cursor, has_more: !!cursor, read_only: false, channel: "private" };
}

describe("chat reconnect history", () => {
  it("fills a gap spanning multiple pages before reaching an existing message", async () => {
    const pages = [page(["6", "7"], "5"), page(["4", "5"], "3"), page(["2", "3"], "1")];
    const seen: (string | undefined)[] = [];
    const result = await catchUpChat(async before => { seen.push(before); return pages.shift()!; }, new Set(["1", "2"]));
    expect(result.messages.map(message => message.id).sort()).toEqual(["2", "3", "4", "5", "6", "7"]);
    expect(seen).toEqual([undefined, "5", "3"]);
  });
  it("keeps the initial history paginated", async () => {
    let calls = 0;
    const result = await catchUpChat(async () => { calls++; return page(["4", "5"], "3"); }, null);
    expect(calls).toBe(1);
    expect(result.next_before).toBe("3");
  });
  it("catches up from an initially empty conversation to the beginning", async () => {
    const pages = [page(["3", "4"], "2"), page(["1", "2"], null)];
    const result = await catchUpChat(async () => pages.shift()!, new Set());
    expect(result.messages).toHaveLength(4);
    expect(pages).toHaveLength(0);
  });
});

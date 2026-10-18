import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, ValidationError } from "@/lib/services/ids";
import { api, ApiError } from "./client";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "test-session" }) }) }));
const fetchMock = vi.fn();

beforeEach(() => { vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockReset(); });

describe("server API boundary", () => {
  it("uses the session and maps request/response fields without corrupting metric keys", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ pairing_id: "pair_1", values: { revenue_php: 600 } })));
    const result = await api("/pairings/pair_1/ledger", { weekStarting: "2026-09-14", values: { revenue_php: 600 } });
    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers.Authorization).toBe("Bearer test-session");
    expect(request.cache).toBe("no-store");
    expect(JSON.parse(request.body)).toEqual({ week_starting: "2026-09-14", values: { revenue_php: 600 } });
    expect(result).toEqual({ pairingId: "pair_1", values: { revenue_php: 600 } });
  });

  it("does not attach credentials to explicit anonymous requests", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    await api("/stats", undefined, true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("preserves authorization and validation failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"detail":"Private pairing"}', { status: 403 }));
    await expect(api("/pairings/private")).rejects.toBeInstanceOf(ForbiddenError);
    fetchMock.mockResolvedValueOnce(new Response('{"detail":[{"loc":["body","hours_per_week"],"msg":"Must be positive"}]}', { status: 422 }));
    await expect(api("/applications", {})).rejects.toThrow(new ValidationError("hours_per_week: Must be positive"));
  });

  it("surfaces an unavailable backend instead of creating local state", async () => {
    fetchMock.mockRejectedValue(new TypeError("Connection refused"));
    await expect(api("/workspace")).rejects.toMatchObject({ status: 503 });
    await expect(api("/ventures", {})).rejects.toBeInstanceOf(ApiError);
  });

  it("handles bodyless successful mutations", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api("/auth/logout", {})).resolves.toBeUndefined();
  });
});

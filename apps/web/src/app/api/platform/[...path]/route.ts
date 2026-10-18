import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/api/client";

const allowed = (path: string, method: string) =>
  (method === "GET" && (["verification", "admin/email-queue"].includes(path) || /^pairings\/[\w-]+\/messages$/.test(path))) ||
  (method === "POST" && (["realtime/token", "assets", "verification/start", "website-preview", "admin/email-queue"].includes(path) || /^pairings\/[\w-]+\/messages$/.test(path) || /^admin\/email-queue\/[\w-]+\/(retry|cancel)$/.test(path)));

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join("/");
  if (!allowed(path, request.method)) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json({ detail: "Invalid request origin" }, { status: 403 });
    }
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ detail: "Sign in to continue" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 4.25 * 1024 * 1024) {
    return NextResponse.json({ detail: "Images must be 4 MB or smaller" }, { status: 413 });
  }
  try {
    const body = request.method === "GET" ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 4.25 * 1024 * 1024) return NextResponse.json({ detail: "Payload too large" }, { status: 413 });
    const response = await fetch(`${process.env.API_URL ?? "http://127.0.0.1:8010"}/${path}${request.nextUrl.search}`, {
      method: request.method, body, cache: "no-store", signal: AbortSignal.timeout(25000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": request.headers.get("content-type") ?? "application/json" },
    });
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers: {
      "Content-Type": "application/json", "Cache-Control": "no-store",
      ...(response.headers.has("retry-after") ? { "Retry-After": response.headers.get("retry-after")! } : {}),
    } });
  } catch {
    return NextResponse.json({ detail: "Counterpart is temporarily unavailable. Please try again." }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;

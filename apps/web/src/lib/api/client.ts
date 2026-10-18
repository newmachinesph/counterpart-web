import { ForbiddenError,NotFoundError,ValidationError } from "@/lib/services/ids";
import { cookies } from "next/headers";
import { transformKeys } from "./transport";

export const SESSION_COOKIE = "cp_session";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, body?: unknown, anonymous = false): Promise<T> {
  const token = anonymous ? undefined : (await cookies()).get(SESSION_COOKIE)?.value;
  let response: Response;
  try {
    response = await fetch(`${process.env.API_URL ?? "http://127.0.0.1:8010"}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(transformKeys(body, "snake")),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(503, "Counterpart is temporarily unavailable. Please try again shortly.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail)
      ? detail.map((e: { msg: string; loc: string[] }) => `${e.loc.slice(1).join(".")}: ${e.msg}`).join(". ")
      : "The request could not be completed.";
    if (response.status === 403) throw new ForbiddenError(message);
    if (response.status === 404) throw new NotFoundError("Record");
    if ([400, 409, 422].includes(response.status)) throw new ValidationError(message);
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return transformKeys(await response.json(), "camel") as T;
}

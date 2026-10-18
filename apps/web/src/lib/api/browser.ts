export async function platform<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/platform/${path}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store",
    headers: body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Please check your input and try again.");
  return data as T;
}

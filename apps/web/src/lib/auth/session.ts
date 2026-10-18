import { api, ApiError } from "@/lib/api/client";
import type { Role, User } from "@/lib/domain/types";
import { redirect } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/api/client";
export { SESSION_COOKIE } from "@/lib/api/client";

export const getSession = cache(async (): Promise<User | null> => {
  if (!(await cookies()).has(SESSION_COOKIE)) return null;
  try { return await api<User>("/me"); }
  catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
});
export async function requireUser(next?: string): Promise<User> {
  const user = await getSession();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}
export async function requireRole(role: Role, next?: string): Promise<User> {
  const user = await requireUser(next);
  if (!hasRole(user, role)) redirect(`/login?need=${role}&next=${encodeURIComponent(next ?? "/")}`);
  return user;
}
export function hasRole(user: User | null, role: Role): boolean {
  return !!user && (user.roles.includes(role) || user.roles.includes("admin"));
}

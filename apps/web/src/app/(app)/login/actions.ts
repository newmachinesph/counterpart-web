"use server";
import { api, SESSION_COOKIE } from "@/lib/api/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function authenticate(form: FormData) {
  const register = form.get("mode") === "register";
  const rawNext = String(form.get("next") ?? "");
  const next = /^\/(?![\/\\])/.test(rawNext) && !/[\\\r\n]/.test(rawNext) ? rawNext : "/dashboard";
  let result: { token: string; expiresIn: number };
  try {
    result = await api(register ? "/auth/register" : "/auth/login", {
      email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""),
      ...(register ? { acceptPlatformTerms: form.get("acceptPlatformTerms") === "on", name: String(form.get("name") ?? ""), role: String(form.get("role") ?? "") } : {}),
    }, true);
  } catch (error) {
    redirect(`/login?mode=${register ? "register" : "login"}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(error instanceof Error ? error.message : "Could not sign in")}`);
  }
  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: result.expiresIn,
    secure: process.env.COOKIE_SECURE === "true",
  });
  redirect(next);
}
export async function signOut() {
  await api("/auth/logout", {});
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}

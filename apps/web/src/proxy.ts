import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard. Only checks that a session cookie exists; role checks and
 * ownership happen in the pages and services where the data is.
 */

const SESSION_COOKIE = "cp_session";

const PROTECTED_PREFIXES = ["/dashboard", "/pairings", "/ventures", "/notifications", "/admin", "/support"];

const APPLY_TO_VENTURE = /^\/bench\/[^/]+\/apply\/?$/;
const JOB_ACTIONS = /^\/jobs\/[^/]+\/(apply|applicants)\/?$/;

function isProtected(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname === "/jobs/new") return true;
  return APPLY_TO_VENTURE.test(pathname) || JOB_ACTIONS.test(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/support/:path*",
    "/jobs/:path*",
    "/dashboard/:path*",
    "/pairings/:path*",
    "/ventures/:path*",
    "/notifications/:path*",
    "/bench/:slug/apply",
  ],
};

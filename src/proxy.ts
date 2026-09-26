import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy (formerly middleware.ts): a cheap first gate only.
 *
 * It cannot reach the database, so it does no more than redirect requests that
 * carry no session cookie at all. Real authentication — validating the token,
 * checking revocation, expiry and tenant scope — happens in the server
 * components and route handlers behind it (src/lib/auth/guard.ts).
 *
 * It deliberately does NOT send a cookie-carrying request away from /login.
 * Presence of a cookie is not proof of a session: once one expires or is
 * revoked, bouncing /login to /dashboard sent the browser into an endless
 * loop, because the guard behind /dashboard rightly sent it straight back.
 * That decision needs the database, so the login page makes it instead.
 */

const SESSION_COOKIE = "risebit_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/account",
  "/set-password",
];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

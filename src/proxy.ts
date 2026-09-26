import { NextResponse, type NextRequest } from "next/server";

import { contentSecurityPolicy, createNonce } from "@/lib/security-headers";

/**
 * Edge proxy (formerly middleware.ts): the CSP nonce, and a cheap first gate.
 *
 * The nonce has to be minted here rather than in next.config, because Next
 * reads it off the *request* during render and stamps it onto the script tags
 * it emits. A static header cannot carry a per-request value.
 *
 * As an auth gate it cannot reach the database, so it does no more than
 * redirect requests that carry no session cookie at all. Real authentication —
 * validating the token, checking revocation, expiry and tenant scope — happens
 * in the server components and route handlers behind it
 * (src/lib/auth/guard.ts).
 *
 * It deliberately does NOT send a cookie-carrying request away from /login.
 * Presence of a cookie is not proof of a session: once one expires or is
 * revoked, bouncing /login to /dashboard sent the browser into an endless
 * loop, because the guard behind /dashboard rightly sent it straight back.
 * That decision needs the database, so the login page makes it instead.
 */

const SESSION_COOKIE = "cfosme_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/account",
  "/set-password",
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev keeps 'unsafe-inline' for React's refresh runtime, and a nonce would
  // make the browser ignore it.
  const nonce = process.env.NODE_ENV === "development" ? null : createNonce();
  const csp = await contentSecurityPolicy(nonce);

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  // Next parses the nonce out of the request's own CSP header; x-nonce is what
  // the root layout reads to stamp the pre-paint theme script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

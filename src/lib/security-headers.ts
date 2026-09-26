import { THEME_INIT_SCRIPT } from "./theme-script";

/**
 * Security response headers, in one place so the proxy and next.config cannot
 * drift apart.
 *
 * Everything here has to run on the Edge runtime, because src/proxy.ts imports
 * it — so no `node:crypto`, no Buffer. Web Crypto and btoa only.
 */

/** Headers that are the same for every request; set in next.config.ts. */
export const STATIC_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/**
 * The pre-paint theme script is inline by necessity — anything fetched would be
 * too late to stop a white flash. It is pinned by hash, computed from the very
 * string that gets rendered, so the two can never drift apart.
 *
 * The hash earns its place alongside the nonce: pages Next serves from the
 * prerender cache (the 404, notably) carry no nonce, and the hash is what keeps
 * them from flashing the wrong theme.
 */
let cachedThemeScriptHash: Promise<string> | undefined;

function themeScriptHash(): Promise<string> {
  cachedThemeScriptHash ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(THEME_INIT_SCRIPT))
    .then((digest) => {
      let binary = "";
      for (const byte of new Uint8Array(digest)) {
        binary += String.fromCharCode(byte);
      }
      return `'sha256-${btoa(binary)}'`;
    });

  return cachedThemeScriptHash;
}

/** A fresh, unguessable nonce. One per request, never reused. */
export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * Content-Security-Policy.
 *
 * Next streams the RSC payload as inline `<script>self.__next_f.push(...)`
 * tags. A policy of `script-src 'self'` blocks those, React then hydrates
 * nothing, and every button, dropdown and toggle on the page is inert — which
 * is exactly what a hash-only policy used to do here. So production names a
 * per-request nonce, which Next stamps onto the scripts it generates itself.
 *
 * `'strict-dynamic'` is deliberately left out: it would drop `'self'`, and with
 * it every chunk on a page served from the prerender cache without a nonce.
 *
 * `unsafe-inline` on style-src is required by Recharts, which sets inline
 * styles on SVG nodes, and by the chart colour variables shadcn emits as a
 * `<style>` tag. Dev additionally needs `unsafe-eval` and inline scripts for
 * React's refresh runtime — and because a nonce makes `unsafe-inline` ignored
 * per the CSP spec, dev gets no nonce at all.
 */
export async function contentSecurityPolicy(
  nonce: string | null,
): Promise<string> {
  return [
    "default-src 'self'",
    nonce
      ? `script-src 'self' 'nonce-${nonce}' ${await themeScriptHash()}`
      : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

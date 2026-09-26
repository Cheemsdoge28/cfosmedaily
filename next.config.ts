import { createHash } from "node:crypto";

import type { NextConfig } from "next";

import { THEME_INIT_SCRIPT } from "./src/lib/theme-script";

/**
 * Content-Security-Policy.
 *
 * `unsafe-inline` on style-src is required by Recharts, which sets inline
 * styles on SVG nodes. Scripts are locked down to self; Next injects its
 * bootstrap with a nonce-free inline script in dev only, hence the dev split.
 */
const isDev = process.env.NODE_ENV === "development";

/**
 * The pre-paint theme script is inline by necessity — anything fetched would be
 * too late to stop a white flash. Rather than open script-src to 'unsafe-inline'
 * it is pinned by hash, computed from the very string that gets rendered.
 */
const themeScriptHash = `'sha256-${createHash("sha256")
  .update(THEME_INIT_SCRIPT)
  .digest("base64")}'`;

const csp = [
  "default-src 'self'",
  // A hash and 'unsafe-inline' are mutually exclusive: per the CSP spec the
  // presence of a hash makes 'unsafe-inline' ignored. Next's dev runtime needs
  // 'unsafe-inline', so the hash is a production-only tightening.
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : `script-src 'self' ${themeScriptHash}`,
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

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

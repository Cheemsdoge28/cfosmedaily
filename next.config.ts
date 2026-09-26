import type { NextConfig } from "next";

import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

/**
 * Content-Security-Policy is deliberately absent here and set in src/proxy.ts
 * instead: it carries a per-request nonce, which a static header cannot. Two
 * CSP headers are both enforced, so a copy here would only re-impose the
 * stricter policy and block the very scripts the nonce is there to allow.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;

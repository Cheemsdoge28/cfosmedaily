import type { MetadataRoute } from "next";

import { canonicalOrigin } from "@/lib/site";

/**
 * robots.txt.
 *
 * This is a private portal, so the default is *disallow*, not allow. Everything
 * behind a sign-in holds one accounting practice's client data; none of it
 * should ever reach a search index, and a crawler that follows a stale link into
 * /dashboard should be told so rather than relying on the login redirect.
 *
 * The exceptions are the three pages that exist to be read by people who have no
 * account: the sign-in page itself and the legal documents. Those are often
 * asked for by a client's own compliance review, so they need to be reachable
 * and findable.
 *
 * `/api/` is listed separately even though it is under no public link: the export
 * route returns a workbook of client data, and an explicit rule is worth more
 * than an assumption that nothing points at it.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = canonicalOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/legal/"],
      disallow: ["/dashboard", "/admin", "/account", "/set-password", "/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

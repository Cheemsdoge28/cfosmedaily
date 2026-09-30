import type { MetadataRoute } from "next";

import { canonicalOrigin, legalIsDraft } from "@/lib/site";

/**
 * sitemap.xml.
 *
 * Only the pages a stranger is meant to reach. Everything else on this portal is
 * one practice's client data behind a sign-in, and listing a URL here while
 * robots.txt disallows it would be two files contradicting each other — which is
 * how a private route ends up indexed.
 *
 * So this is four entries at most and will stay four. If it ever grows, that is
 * a sign something private has been made public by accident.
 *
 * While the legal documents still have unsupplied details they are left out
 * entirely, so a half-written privacy notice is never advertised for crawling.
 * The same condition marks them noindex, and the two are driven from one place
 * rather than two that can fall out of step.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = canonicalOrigin();

  // The sign-in page effectively never changes, and a lastModified of "now" on
  // every crawl tells a crawler nothing it can act on — so the build date is
  // deliberately not used here.
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/login`,
      changeFrequency: "yearly",
      priority: 1,
    },
  ];

  if (legalIsDraft()) return entries;

  for (const path of ["/legal/privacy", "/legal/terms", "/legal/security"]) {
    entries.push({
      url: `${origin}${path}`,
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  return entries;
}

import type { MetadataRoute } from "next";

import { canonicalOrigin } from "@/lib/site";

/**
 * sitemap.xml.
 *
 * Only the pages a stranger is meant to reach. Everything else on this portal is
 * one practice's client data behind a sign-in, and listing a URL here while
 * robots.txt disallows it would be two files contradicting each other — which is
 * how a private route ends up indexed.
 *
 * So this is four entries and will stay four entries. If it ever grows, that is
 * a sign something private has been made public by accident.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = canonicalOrigin();

  // The legal pages change when the product does; the entry page effectively
  // never does. Stated rather than computed, because a lastModified of "now" on
  // every crawl tells a crawler nothing it can act on.
  const reviewed = new Date("2026-09-30T00:00:00Z");

  return [
    {
      url: `${origin}/login`,
      lastModified: reviewed,
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: `${origin}/legal/privacy`,
      lastModified: reviewed,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${origin}/legal/terms`,
      lastModified: reviewed,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${origin}/legal/security`,
      lastModified: reviewed,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}

/**
 * Facts about the deployment that both the metadata and the legal pages need.
 *
 * Kept free of `server-only` because the legal pages render these strings, and
 * free of the database because robots.txt and the sitemap must resolve at build
 * time without one.
 */

/** The product, as it is named to people outside the practice. */
export const SITE_NAME = "CFOSME Pulse Pro";

export const SITE_DESCRIPTION =
  "CFOSME's task register — client delivery, workload, deadlines and completion, in one place.";

/**
 * Who answers a privacy or security question about this deployment.
 *
 * Deliberately one constant rather than an address typed into three documents:
 * a policy that names a mailbox nobody reads is worse than one that names none,
 * and this is the value most likely to need changing after handover.
 */
export const CONTACT_EMAIL = "privacy@cfosme.in";

/** The organisation that operates the portal and controls the data in it. */
export const OPERATOR = "CFOSME";

/**
 * The canonical origin.
 *
 * `APP_URL` is already the value that decides the Secure cookie flag and the
 * same-origin checks, so it is the one that should decide canonical links too —
 * a second variable for the same fact is a second thing to get wrong. Falls back
 * to localhost so a developer build produces valid absolute URLs rather than
 * throwing inside a metadata route.
 */
export function canonicalOrigin(): string {
  const raw = process.env.APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * The date the legal documents were last reviewed.
 *
 * A constant, not `new Date()`. A policy that always says "last updated today"
 * is telling the reader something false, and the date is exactly what a reader
 * checks to decide whether the document still describes the product.
 */
export const POLICY_UPDATED = "30 September 2026";

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
  let origin = process.env.APP_URL ?? "http://localhost:3000";
  // Trimmed in a loop rather than with /\/+$/, which backtracks on a long run
  // of slashes.
  while (origin.endsWith("/")) origin = origin.slice(0, -1);
  return origin;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unresolved facts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything the legal documents assert that nobody has actually decided yet.
 *
 * These were invented on a first pass — a contact address, a governing
 * jurisdiction, a response window, a review date — and an invented fact in a
 * privacy notice is worse than a gap, because a gap is visibly a gap and an
 * invention reads as a commitment. A reader cannot tell that "we respond within
 * 30 days" was a guess, and neither can the person who has to honour it.
 *
 * So each is `null` until someone supplies it, and null renders as a marked
 * placeholder rather than as plausible prose. While any of them is unresolved
 * the documents carry a draft notice, drop out of the sitemap, and are not
 * indexed — see `legalIsDraft`.
 *
 * Fill these in, and all of that turns itself off.
 */
export const SITE_DETAILS = {
  /** Where a privacy, security or terms question goes. */
  contactEmail: null as string | null,

  /**
   * The person named to receive grievances. The DPDP Act, 2023 requires a Data
   * Fiduciary to publish this; it is not optional and it is not a generic inbox.
   */
  grievanceOfficer: null as { name: string; email: string } | null,

  /** Registered address of the operator, for the notices. */
  postalAddress: null as string | null,

  /** e.g. "the courts of Mumbai, Maharashtra". A country alone is not enough. */
  jurisdiction: null as string | null,

  /**
   * The processors that hold the data, named. A privacy notice that says "a
   * managed host" without naming it does not let a reader check anything.
   */
  processors: null as string[] | null,

  /** How long records are kept once an engagement ends. */
  retentionPeriod: null as string | null,

  /** The window the operator commits to for answering a rights request. */
  rightsResponseWindow: null as string | null,

  /** What the hosting arrangement actually provides, in the operator's words. */
  hostingStatement: null as string | null,

  /** The date a person actually reviewed these documents. Not the build date. */
  reviewedOn: null as string | null,
} as const;

/** The keys still to be supplied, in the order a reader would meet them. */
export function unresolvedDetails(): string[] {
  return Object.entries(SITE_DETAILS)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
}

/**
 * True while any legal detail is still unsupplied.
 *
 * Drives three things at once, so nobody has to remember all three: the draft
 * banner on the documents, their exclusion from the sitemap, and their
 * `noindex`. A half-written privacy notice being crawled is the failure mode
 * this is here to prevent.
 */
export function legalIsDraft(): boolean {
  return unresolvedDetails().length > 0;
}

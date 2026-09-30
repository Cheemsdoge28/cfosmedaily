/**
 * Are the legal documents ready to publish?
 *
 * There is a version of this project where somebody fills in the contact address
 * and forgets the jurisdiction, ships, and finds out when a client's reviewer
 * reads it. This is the check that catches that: it fails while any detail in
 * `SITE_DETAILS` is still unsupplied, and prints the ones outstanding.
 *
 *   npm run check:legal
 *
 * Wire it into the deploy step, not the dev loop — the documents are *meant* to
 * be a draft while the product is being built, and a check that fails all day is
 * a check people learn to ignore.
 */

import { SITE_DETAILS, unresolvedDetails } from "../src/lib/site";

/** What each key is for, so the output is a to-do list rather than a field name. */
const WHAT_IT_IS: Record<string, string> = {
  contactEmail: "a monitored address for privacy, security and terms questions",
  grievanceOfficer:
    "the named Grievance Officer and their e-mail — required by the DPDP Act, not optional",
  postalAddress: "the operator's registered address, for the notices",
  jurisdiction: "the specific courts, e.g. \"the courts of Mumbai, Maharashtra\"",
  processors: "every host and database provider, named, with its country",
  retentionPeriod: "how long records are kept after an engagement ends",
  rightsResponseWindow: "the window committed to for answering a rights request",
  hostingStatement: "region, encryption at rest, and the backup/restore arrangement",
  reviewedOn: "the date a qualified person actually reviewed these documents",
};

const missing = unresolvedDetails();
const supplied = Object.keys(SITE_DETAILS).length - missing.length;

if (missing.length === 0) {
  console.log(
    `Legal documents: all ${supplied} details supplied. Privacy, terms and security are publishable.`,
  );
  process.exit(0);
}

console.log(
  `Legal documents are a DRAFT — ${supplied} of ${supplied + missing.length} details supplied.\n`,
);
console.log("Still to decide, in src/lib/site.ts:\n");
for (const key of missing) {
  console.log(`  ${key.padEnd(22)} ${WHAT_IT_IS[key] ?? ""}`);
}
console.log(
  [
    "",
    "While any remain, the privacy, terms and security pages:",
    "  - carry a visible draft notice,",
    "  - are served noindex,",
    "  - and are left out of sitemap.xml.",
    "",
    "The privacy notice and the terms also need review by someone qualified to",
    "approve them. Filling these in does not substitute for that.",
  ].join("\n"),
);

process.exitCode = 1;

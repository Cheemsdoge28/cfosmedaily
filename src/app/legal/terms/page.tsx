import type { Metadata } from "next";
import Link from "next/link";

import { ContactEmail, LegalPage, Placeholder } from "@/app/legal/legal-page";
import { OPERATOR, SITE_DETAILS, SITE_NAME, legalIsDraft } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The terms on which ${OPERATOR} provides access to ${SITE_NAME}.`,
  // Never index a document that still has gaps in it.
  robots: legalIsDraft()
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

/**
 * Terms of use.
 *
 * Scoped to the portal itself — who may use it and how — and deliberately not to
 * the accounting engagement, which lives in its own agreement. Two documents
 * covering the same ground is how they end up contradicting each other.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      summary={`These terms govern access to ${SITE_NAME}, the private portal operated by ${OPERATOR}. They cover the portal only — the professional services themselves are governed by your engagement letter.`}
    >
      <h2>1. Who may use it</h2>
      <p>
        Access is by invitation. {OPERATOR} issues accounts to its own staff and
        to named people at client organisations. You may use the portal only with
        an account issued to you, and only for the purposes of the engagement
        between {OPERATOR} and your organisation.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>
          Your account is personal to you. Do not share it, and do not let
          someone else use it — the record of who did what depends on this.
        </li>
        <li>
          Choose a password you do not use anywhere else, and change any
          temporary password at first sign-in.
        </li>
        <li>
          Tell {OPERATOR} promptly if you believe someone else has used your
          account, or if someone in your organisation leaves and should no longer
          have access.
        </li>
        <li>
          You are responsible for what is done through your account while it is in
          your control.
        </li>
      </ul>

      <h2>3. What you may do with the information</h2>
      <p>
        The portal shows work status relating to your organisation. You may use it
        for your own internal purposes. You may not:
      </p>
      <ul>
        <li>
          attempt to reach another organisation&rsquo;s information, whether by
          altering a web address, a request, or otherwise;
        </li>
        <li>
          copy, scrape or extract the register other than through the download
          the portal provides;
        </li>
        <li>
          probe, scan or test the security of the service, or interfere with its
          operation, without written permission;
        </li>
        <li>
          republish information from the portal outside your organisation.
        </li>
      </ul>
      <p>
        If you find you can see something you should not, tell us at{" "}
        <ContactEmail /> rather than exploring further.
      </p>

      <h2>4. Accuracy of what you see</h2>
      <p>
        The register is maintained from {OPERATOR}&rsquo;s working workbook and is
        updated as work progresses. It is a management view of status and
        deadlines, not a statutory record, and it is not accounting, tax or legal
        advice. Where the portal and your engagement documentation disagree, the
        engagement documentation governs.
      </p>
      <p>
        Due dates shown are {OPERATOR}&rsquo;s internal working targets. They are
        not a substitute for the statutory deadlines that apply to your
        organisation.
      </p>

      <h2>5. Availability</h2>
      <p>
        We aim to keep the portal available but do not guarantee uninterrupted
        access. It may be unavailable during maintenance or because of a failure
        at one of our infrastructure providers. The portal is a convenience; it is
        not the only channel through which {OPERATOR} communicates with you.
      </p>

      <h2>6. Changes and withdrawal of access</h2>
      <p>
        We may change or withdraw features, and we may suspend or withdraw an
        account — for example when someone leaves your organisation, when an
        engagement ends, or where these terms have been breached. Where an account
        is removed, the record of what it did is retained; see the{" "}
        <Link href="/legal/privacy">privacy notice</Link>.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The portal, its design and its software belong to {OPERATOR} or its
        licensors. Nothing here transfers any right in them to you. The task data
        relating to your organisation remains yours.
      </p>

      <h2>8. Liability</h2>
      <p>
        <Placeholder label="liability clause — to be drafted and approved by a lawyer" />
      </p>
      <p>
        This section is deliberately empty rather than filled with a plausible
        limitation. A liability clause decides who carries a loss, and one nobody
        has approved is worse than none at all.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Disputes are subject to the
        exclusive jurisdiction of{" "}
        {SITE_DETAILS.jurisdiction ?? (
          <Placeholder label="seat of jurisdiction — the specific courts, e.g. the courts of Mumbai" />
        )}
        .
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms go to <ContactEmail />.
      </p>
    </LegalPage>
  );
}

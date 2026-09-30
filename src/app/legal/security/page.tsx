import type { Metadata } from "next";

import { ContactEmail, LegalPage, Placeholder } from "@/app/legal/legal-page";
import { OPERATOR, SITE_DETAILS, SITE_NAME, legalIsDraft } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security",
  description: `How ${SITE_NAME} protects client information: access control, credentials, sessions and audit.`,
  // Overrides the portal-wide noindex: this is one of the pages that exists to
  // be read by someone with no account.
  // Never index a document that still has gaps in it.
  robots: legalIsDraft()
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

/**
 * The security statement.
 *
 * Unlike the privacy policy and the terms, every claim on this page describes
 * behaviour that is actually implemented, and each one is checkable in the
 * source. That is deliberate: a security page that describes aspirations is
 * worse than none, because a client's reviewer will hold you to it.
 */
export default function SecurityPage() {
  return (
    <LegalPage
      title="Security"
      summary={`How ${SITE_NAME} protects the information it holds. Except where marked, everything described here is implemented in the product and can be checked against the source — none of it is aspirational.`}
    >
      <h2>What the portal holds</h2>
      <p>
        A register of recurring accounting, compliance and reporting tasks:
        which client each belongs to, who owns it, when it is due, and how far
        along it is. It also holds the sign-in accounts of the people who use it
        and a log of what they did.
      </p>
      <p>
        It does <b>not</b> hold ledgers, invoices, bank details, tax filings or
        any client financial records. It tracks the work, not the books.
      </p>

      <h2>Who can see what</h2>
      <p>
        Access is granted one client at a time. Each grant is either{" "}
        <b>view only</b> or <b>can edit</b>, so the same person can be read-write
        on one client and read-only on another.
      </p>
      <ul>
        <li>
          Filtering happens when the data is fetched, not by hiding things on
          screen. A page that failed to filter would return nothing rather than
          everything.
        </li>
        <li>
          A client named in the address bar that the account holds no grant for
          narrows the result to what it may see. It cannot widen it.
        </li>
        <li>
          Every write is re-checked against that task&rsquo;s own client before it
          is applied.
        </li>
        <li>
          {OPERATOR} staff accounts read every client by role. That is the only
          way to see across clients, and it is held by named accounts.
        </li>
      </ul>

      <h2>Credentials</h2>
      <ul>
        <li>
          Passwords are hashed with bcrypt at cost 12. They are never stored or
          logged in a readable form and cannot be recovered — only reset.
        </li>
        <li>
          A password must be at least 12 characters and contain an upper-case
          letter, a lower-case letter, a digit and a symbol.
        </li>
        <li>
          Five failed attempts lock the account for a period. A failed sign-in
          takes the same time whether or not the address exists, so the page
          cannot be used to discover who has an account.
        </li>
        <li>
          An administrator can reset a password but cannot read one. A reset
          issues a temporary password shown once and signs that person out
          everywhere.
        </li>
      </ul>

      <h2>Sessions</h2>
      <ul>
        <li>
          The browser holds an opaque random token. Only its SHA-256 hash is
          stored, so a copy of the database cannot be replayed as a sign-in.
        </li>
        <li>
          Sessions expire 12 hours after they are issued, and after 2 hours of
          inactivity, whichever comes first.
        </li>
        <li>
          Sessions are revocable. Changing a password, resetting one, removing an
          account or withdrawing access ends them.
        </li>
        <li>
          Access is re-read from the database on every request, so withdrawing a
          client takes effect on that person&rsquo;s next page load rather than
          whenever their session happens to lapse.
        </li>
        <li>
          Everyone can see their own active sessions, and an administrator can
          end any of them individually.
        </li>
      </ul>

      <h2>Audit trail</h2>
      <p>
        The log is append-only and records the time, the account, the client
        where one applies, and the originating IP address for:
      </p>
      <ul>
        <li>every sign-in, refused sign-in and lock-out;</li>
        <li>every password change and reset;</li>
        <li>every account created, changed, deactivated, removed or restored;</li>
        <li>
          every grant of client access, change of level and withdrawal, recorded
          per client rather than as a batch;
        </li>
        <li>every workbook import and every register download;</li>
        <li>
          every task that moves, with its before and after state — kept as a full
          history, not only the most recent change.
        </li>
      </ul>

      <h2>Removing an account</h2>
      <p>
        Removing someone hides their account and signs them out, but deletes
        nothing. The audit entries they wrote, the tasks they moved and the
        access they held are kept, because a register that cannot say who
        completed a task is not a record. A removed account cannot sign in and
        does not appear anywhere except the administration screen that can
        restore it.
      </p>

      <h2>In transit and at rest</h2>
      <ul>
        <li>
          Served over HTTPS. Session cookies are HTTP-only, same-site and marked
          secure when the deployment is served over HTTPS.
        </li>
        <li>
          A Content-Security-Policy is applied to every response, with a fresh
          per-request nonce, alongside HSTS, frame-denial, MIME-sniffing
          protection and a restrictive permissions policy.
        </li>
        <li>
          Data is held in a managed PostgreSQL database.{" "}
          {SITE_DETAILS.hostingStatement ?? (
            <Placeholder label="hosting — provider, region, encryption at rest, and the backup and restore arrangement" />
          )}{" "}
          Unlike the rest of this page, that is a property of the hosting
          arrangement rather than of the software, so it is stated by the
          operator rather than asserted here.
        </li>
        <li>
          Register downloads are never cached, so one client&rsquo;s workbook
          cannot be served to another.
        </li>
      </ul>

      <h2>What we ask of you</h2>
      <ul>
        <li>One account per person. Shared logins make the audit trail useless.</li>
        <li>
          Tell {OPERATOR} the day someone leaves, so their account can be removed.
        </li>
        <li>
          Send a temporary password separately from the e-mail address it belongs
          to, never in the same message.
        </li>
      </ul>

      <h2>Reporting a problem</h2>
      <p>
        If you believe you have found a security issue, write to <ContactEmail />{" "}
        with enough detail to reproduce it. Please do not post it publicly before
        we have had a chance to respond.
      </p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/app/legal/legal-page";
import { CONTACT_EMAIL, OPERATOR, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What personal information ${SITE_NAME} holds, why, and for how long.`,
  robots: { index: true, follow: true },
};

/**
 * The privacy notice.
 *
 * Written against what the product actually stores — the columns are real and so
 * are the retention rules — so that it can be checked rather than believed. The
 * lawful-basis and rights sections follow India's DPDP Act 2023, which is the
 * regime this deployment sits under.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      summary={`${SITE_NAME} is a private portal operated by ${OPERATOR}. This notice explains what personal information it holds, why it holds it, and what you can ask us to do with it.`}
    >
      <h2>Who is responsible</h2>
      <p>
        {OPERATOR} operates this portal and decides what is held in it. For the
        purposes of the Digital Personal Data Protection Act, 2023, {OPERATOR} is
        the Data Fiduciary. Questions go to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>What we hold about you</h2>
      <p>
        This portal is a register of professional work, not a store of personal
        records. The personal information in it is limited to what an account and
        an audit trail require:
      </p>
      <table>
        <thead>
          <tr>
            <th>What</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name and work e-mail address</td>
            <td>To identify your account and address you in the interface.</td>
          </tr>
          <tr>
            <td>A hash of your password</td>
            <td>
              To verify a sign-in. The password itself is never stored and cannot
              be recovered by anyone, including us.
            </td>
          </tr>
          <tr>
            <td>Which clients you may see, and at what level</td>
            <td>To show you your work and nobody else&rsquo;s.</td>
          </tr>
          <tr>
            <td>
              Sign-in times, failed attempts, IP address and browser description
            </td>
            <td>
              To detect and stop unauthorised access, and to let you see where
              your account is signed in.
            </td>
          </tr>
          <tr>
            <td>A record of what you changed, and when</td>
            <td>
              So the register can say who completed a task. This is the point of
              the product.
            </td>
          </tr>
          <tr>
            <td>The owner name recorded against a task</td>
            <td>
              Taken from the practice&rsquo;s workbook. It may name someone who
              has no account here.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not use cookies for advertising or analytics, and there are no
        third-party trackers. The only cookies set are the one that keeps you
        signed in and one that remembers whether your sidebar is open.
      </p>

      <h2>Why we are allowed to hold it</h2>
      <ul>
        <li>
          <b>To perform our engagement.</b> Your employer or client engaged{" "}
          {OPERATOR}, and running the work calendar is part of that.
        </li>
        <li>
          <b>Legitimate uses.</b> Keeping an audit trail and protecting accounts
          against unauthorised access.
        </li>
        <li>
          <b>Legal obligation.</b> Where professional or statutory record-keeping
          requires us to retain a record of work performed.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Nobody, other than the infrastructure providers that run the service on
        our behalf:
      </p>
      <ul>
        <li>a managed application host, which serves the site;</li>
        <li>a managed PostgreSQL provider, which stores the data.</li>
      </ul>
      <p>
        Both act on our instructions only. We do not sell personal information,
        and we do not share it with advertisers. We will disclose information
        where the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <b>Your account</b> — for as long as you need access. When an account is
          removed it is hidden and can no longer sign in, but the record of what
          it did is kept, as below.
        </li>
        <li>
          <b>The audit trail and task history</b> — retained for the life of the
          engagement and any period professional record-keeping requires
          afterwards. This is why removing an account does not erase the entries
          it wrote: a record of work that can be made to forget who did the work
          is not a record.
        </li>
        <li>
          <b>Sessions</b> — expire within 12 hours and are deleted on the normal
          database retention cycle.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>Under the DPDP Act, 2023 you may ask us to:</p>
      <ul>
        <li>tell you what we hold about you and who we have shared it with;</li>
        <li>correct anything inaccurate, incomplete or out of date;</li>
        <li>
          erase what we hold, where we are not required to keep it for the
          reasons set out above;
        </li>
        <li>nominate someone to exercise these rights if you cannot;</li>
        <li>
          complain to us, and then to the Data Protection Board of India if you
          are not satisfied with our answer.
        </li>
      </ul>
      <p>
        Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will
        respond within 30 days. Where we cannot erase something, we will tell you
        which obligation requires us to keep it.
      </p>

      <h2>How it is protected</h2>
      <p>
        Access control, password handling, sessions and the audit trail are
        described in detail on the{" "}
        <Link href="/legal/security">security page</Link>.
      </p>

      <h2>Changes</h2>
      <p>
        If this notice changes in a way that affects you, we will tell the people
        with accounts rather than relying on you to re-read the page. The review
        date at the top always reflects the current version.
      </p>
    </LegalPage>
  );
}

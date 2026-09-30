import { SITE_DETAILS, legalIsDraft, unresolvedDetails } from "@/lib/site";

/**
 * A fact nobody has supplied yet.
 *
 * Rendered as a marked gap, not as prose. The whole point is that it cannot be
 * mistaken for a decision: an invented contact address or an invented governing
 * jurisdiction reads exactly like a real one, so the reader — and the person who
 * would have to honour it — has no way to tell it was a guess.
 *
 * `label` says what is missing in the words the person filling it in would use,
 * so the page doubles as the checklist.
 */
export function Placeholder({ label }: { label: string }) {
  return (
    <mark
      // Not a styled <span>: this genuinely is marked-up text awaiting review,
      // and <mark> is what a screen reader announces as highlighted.
      className="mx-0.5 rounded-sm bg-[var(--tone-warn-bg)] px-1.5 py-0.5 font-mono text-[0.8em] font-semibold whitespace-nowrap text-[var(--tone-warn-fg)]"
      title="This detail has not been supplied yet"
    >
      [ {label} ]
    </mark>
  );
}

/**
 * Shown at the top of every legal document while anything is unresolved.
 *
 * Deliberately loud and deliberately unremovable-by-accident: it disappears on
 * its own the moment the last detail in SITE_DETAILS is filled in, and not
 * before. The same condition also keeps these pages out of the sitemap and out
 * of search indexes, so a draft cannot be crawled.
 */
function DraftNotice() {
  const missing = unresolvedDetails();

  return (
    <aside className="mb-8 rounded-[var(--radius-card)] border border-[var(--caution)]/40 bg-[var(--tone-warn-bg)] p-5">
      <p className="text-sm font-semibold text-[var(--tone-warn-fg)]">
        Draft — not yet reviewed, and not fit to rely on
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--tone-warn-fg)]">
        This document has not been checked by anyone qualified to approve it, and
        the highlighted gaps below have not been decided. Nothing here should be
        treated as a commitment, shown to a client, or published until both are
        resolved.
      </p>
      <p className="mt-3 text-xs text-[var(--tone-warn-fg)]">
        {missing.length} detail{missing.length === 1 ? "" : "s"} outstanding, set
        in <code className="font-mono">src/lib/site.ts</code>:{" "}
        <span className="font-mono">{missing.join(", ")}</span>. While any remain,
        these pages are excluded from the sitemap and marked noindex.
      </p>
    </aside>
  );
}

/**
 * The shared typography for a legal document.
 *
 * One component rather than the same Tailwind classes retyped on three pages,
 * because the thing that goes wrong with policy pages is that they drift into
 * three slightly different documents.
 */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      {legalIsDraft() && <DraftNotice />}

      <h1 className="text-3xl leading-9 font-semibold tracking-tight text-heading">
        {title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {summary}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        {SITE_DETAILS.reviewedOn ? (
          <>Last reviewed {SITE_DETAILS.reviewedOn}</>
        ) : (
          <>
            Last reviewed <Placeholder label="review date" />
          </>
        )}
      </p>

      <div
        className={[
          "mt-8 space-y-6",
          "[&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-heading",
          "[&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-heading",
          "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground",
          "[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-foreground",
          "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:ps-5",
          "[&_a]:font-medium [&_a]:text-heading [&_a]:underline [&_a]:underline-offset-2",
          "[&_table]:w-full [&_table]:text-sm",
          "[&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase",
          "[&_td]:border-b [&_td]:border-border/60 [&_td]:py-2.5 [&_td]:pe-4 [&_td]:align-top",
        ].join(" ")}
      >
        {children}
      </div>
    </article>
  );
}

/**
 * The contact address, or a marked gap where it should be.
 *
 * Used often enough across the three documents to be worth one component — and
 * worth one component precisely because a contact address that differs between
 * two policy pages is a classic way to end up with an unmonitored mailbox.
 */
export function ContactEmail() {
  if (!SITE_DETAILS.contactEmail) {
    return <Placeholder label="contact e-mail" />;
  }
  return (
    <a href={`mailto:${SITE_DETAILS.contactEmail}`}>{SITE_DETAILS.contactEmail}</a>
  );
}

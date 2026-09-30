import Link from "next/link";

import { CfosmeWordmark } from "@/components/ui/brand";
import { SITE_DETAILS, SITE_NAME } from "@/lib/site";

/**
 * The frame the legal documents sit in.
 *
 * Deliberately outside the portal shell. These pages are read by people with no
 * account — a client's compliance reviewer, somebody deciding whether to sign in
 * at all — so they get a plain, readable page rather than a sidebar and a set of
 * filters that would only be furniture to them.
 *
 * Light ground in both themes: this is a document, and a document that changes
 * colour with the reader's OS is a document that prints differently for two
 * people who think they are looking at the same thing.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[52rem] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/login" aria-label={SITE_NAME} className="shrink-0">
            <CfosmeWordmark className="h-8 w-auto" priority />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-heading underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[52rem] px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[52rem] px-5 py-8 sm:px-8">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link
              href="/legal/privacy"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Terms of use
            </Link>
            <Link
              href="/legal/security"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Security
            </Link>
          </nav>
          <p className="mt-4 text-xs text-muted-foreground">
            {SITE_NAME} ·{" "}
            {SITE_DETAILS.reviewedOn
              ? `Last reviewed ${SITE_DETAILS.reviewedOn}`
              : "These documents are a draft and have not been reviewed"}
          </p>
        </div>
      </footer>
    </div>
  );
}

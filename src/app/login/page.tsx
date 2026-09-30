import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Note } from "@/components/ui/primitives";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  // One of the three pages meant to be reachable without an account, so it opts
  // back in to indexing over the portal-wide default.
  robots: { index: true, follow: true },
};

export default async function LoginPage() {
  /**
   * Send an already signed-in visitor on to their dashboard.
   *
   * This lives here rather than in the proxy because it needs the database:
   * the proxy can only see that a cookie exists, and a cookie that no longer
   * maps to a live session would send the browser round in circles. A stale
   * cookie simply falls through to the form and is replaced on the next
   * successful sign-in.
   */
  const user = await getSessionUser();
  if (user) {
    redirect(
      "/dashboard",
    );
  }

  return (
    <AuthCard
      title="Client sign in"
      description="Secure access to your task register."
      footer={
        <>
          <Note>
            Access is restricted to authorised users. If you need credentials,
            contact your CFOSME engagement lead.
          </Note>
          {/* Reachable before signing in, because the people most likely to want
              them are the ones deciding whether to sign in at all. */}
          <nav className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
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
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/app/(portal)/account/change-password-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * Forced password change after an administrator reset.
 *
 * Deliberately outside the portal layout: that layout redirects here whenever
 * `mustChangePassword` is set, so hosting this page inside it would loop.
 */
export default async function SetPasswordPage() {
  const user = await requireUser();

  if (!user.mustChangePassword) redirect("/dashboard");

  return (
    <AuthCard
      width="wide"
      title="Set a new password"
      description="Your password was issued by an administrator and must be changed before you can open the dashboard."
      footer={
        <form action="/api/auth/logout" method="post" className="mt-6">
          <Button
            type="submit"
            variant="link"
            className="px-0 text-muted-foreground hover:text-foreground"
          >
            Sign out instead
          </Button>
        </form>
      }
    >
      <ChangePasswordForm />
    </AuthCard>
  );
}

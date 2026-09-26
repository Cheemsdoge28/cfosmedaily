import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PortalShell } from "@/components/shell/portal-shell";
import { requireUser } from "@/lib/auth/guard";

/**
 * Authenticated shell.
 *
 * This is the real gate: middleware only sees whether a cookie exists, whereas
 * `requireUser` validates the session against the database on every request.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // The sidebar's own cookie, read here so the server renders it in the state
  // the operator left it in — otherwise it paints open and snaps shut.
  const sidebarOpen =
    (await cookies()).get("sidebar_state")?.value !== "false";

  // An admin-issued reset must be completed before anything else is reachable.
  if (user.mustChangePassword) redirect("/set-password");

  return (
    <PortalShell
      defaultOpen={sidebarOpen}
      user={{
        name: user.name,
        // What the header says beneath the product name. A member with one client
        // sees its name; with several, a count; staff see the practice.
        scope: user.isPlatformAdmin
          ? "CFOSME"
          : user.grants.length === 1
            ? user.grants[0]!.name
            : `${user.grants.length} clients`,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin,
      }}
    >
      {children}
    </PortalShell>
  );
}

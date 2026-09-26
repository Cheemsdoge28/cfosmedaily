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
        clientName: user.clientName,
        role: user.role,
        isPlatformAdmin: user.role === "PLATFORM_ADMIN",
      }}
    >
      {children}
    </PortalShell>
  );
}

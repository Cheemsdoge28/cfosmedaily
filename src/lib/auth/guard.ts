import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * Route guards.
 *
 * Middleware only checks that a session cookie is present — it runs on the edge
 * and cannot reach the database. These helpers are the real gate and run in
 * every protected server component and route handler.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** A signed-in user who is bound to a tenant, with that tenant's id resolved. */
export async function requireClientScope(): Promise<
  SessionUser & { clientId: string }
> {
  const user = await requireUser();

  if (!user.clientId) {
    // Platform admins have no implicit tenant; they pick one in /admin.
    redirect("/admin");
  }

  return user as SessionUser & { clientId: string };
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "PLATFORM_ADMIN") redirect("/dashboard");
  return user;
}

/** May this user administer the given tenant (manage users, run a sync)? */
export function canAdminister(user: SessionUser, clientId: string): boolean {
  if (user.role === "PLATFORM_ADMIN") return true;
  return user.role === "CLIENT_ADMIN" && user.clientId === clientId;
}

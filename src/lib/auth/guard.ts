import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * Route guards.
 *
 * Middleware only checks that a session cookie is present — it runs on the edge
 * and cannot reach the database. These helpers are the real gate and run in
 * every protected server component and route handler.
 *
 * There is no `requireClientScope` here any more. It redirected a reader with no
 * tenant of their own to /admin, which was correct when every reader belonged to
 * exactly one client. CFOSME staff read across all of them, so resolving who may
 * see which tasks is its own concern — see src/lib/tasks/scope.ts.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "PLATFORM_ADMIN") redirect("/dashboard");
  return user;
}

/**
 * `canAdminister` is gone.
 *
 * It answered "may this user manage this tenant", and under the old model a
 * CLIENT_ADMIN could. Administration is now a platform-admin matter only, and
 * what a member may *do* with a client is their grant's level — asked and
 * answered by `canEditClient` in src/lib/tasks/scope.ts, next to the queries it
 * guards rather than here.
 */

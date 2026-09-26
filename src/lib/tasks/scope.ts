import "server-only";

import { requireUser } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Who may see which tasks.
 *
 * This is the one difference in shape from the portal this was forked from,
 * and it is a deliberate one. There, every reader belonged to exactly one
 * tenant and a cross-tenant view made no sense. Here the practice's own staff
 * are the primary readers: "completion by client" and "workload by owner" are
 * the questions the dashboard exists to answer, and both are cross-client.
 *
 * So there are two scopes:
 *
 *   practice  CFOSME staff (PLATFORM_ADMIN). Reads every client, and may
 *             narrow to one with the client slicer.
 *   client    A client's own login. Pinned to their tenant; the client slicer
 *             is fixed and every query is filtered whatever the URL says.
 *
 * The pin is applied in `taskScopeFilter` rather than in the page, so a page
 * that forgets to filter cannot leak another client's register.
 */

export type TaskScope = {
  user: SessionUser;
  /** True for CFOSME staff, who read across clients. */
  isPractice: boolean;
  /** Set for a client-bound login; null for practice staff. */
  pinnedClientId: string | null;
};

export async function requireTaskScope(): Promise<TaskScope> {
  const user = await requireUser();

  return {
    user,
    isPractice: user.role === "PLATFORM_ADMIN",
    pinnedClientId: user.role === "PLATFORM_ADMIN" ? null : user.clientId,
  };
}

/**
 * The `where` fragment every task query starts from.
 *
 * `requested` is what the URL asked for. For practice staff it is honoured; for
 * a client login it is ignored entirely in favour of their own tenant, so a
 * hand-edited `?client=` cannot widen what they see.
 */
export function taskScopeFilter(
  scope: TaskScope,
  requested?: string | null,
): { clientId?: string } {
  if (scope.pinnedClientId) return { clientId: scope.pinnedClientId };
  if (requested) return { clientId: requested };
  return {};
}

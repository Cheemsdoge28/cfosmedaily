import "server-only";

import { requireUser } from "@/lib/auth/guard";
import type { TaskScope } from "@/lib/tasks/access";

/**
 * Resolving the caller's scope from their session.
 *
 * Only this half needs a request, so only this half is server-only. The rules
 * themselves — what the scope permits — are pure functions in access.ts, and are
 * re-exported here so call sites keep one import.
 *
 * The split is not tidiness: it is what lets `npm run check:access` construct a
 * scope from real grants and exercise the real predicates, instead of a second
 * copy of the rules written for the check.
 */

export type { TaskScope };
export {
  canEditAnything,
  canEditClient,
  editableClientIds,
  scopeLabel,
  taskScopeFilter,
} from "@/lib/tasks/access";

export async function requireTaskScope(): Promise<TaskScope> {
  const user = await requireUser();

  // A platform admin reads every client through the role. Their grant list is
  // empty by design, and `visibleClientIds: null` is what says "unrestricted" —
  // as opposed to an empty array, which says "nothing".
  if (user.isPlatformAdmin) {
    return { user, isPractice: true, visibleClientIds: null, grants: [] };
  }

  return {
    user,
    isPractice: false,
    visibleClientIds: user.grants.map((grant) => grant.id),
    grants: user.grants,
  };
}

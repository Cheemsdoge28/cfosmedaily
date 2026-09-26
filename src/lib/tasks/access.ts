import type { GrantedClient, SessionUser } from "@/lib/auth/session";

/**
 * Who may see which tasks, and which of them they may change.
 *
 * Deliberately free of `server-only`, of the session lookup, and of anything
 * that reaches for a request: these are pure functions over a resolved scope.
 * That is what lets `npm run check:access` build a scope from real database rows
 * and run *these exact functions* over it, rather than a second copy of the rules
 * written for the test — which is the copy that drifts.
 *
 * Resolving the scope from the caller's session is the other half, and lives in
 * scope.ts next to the guard it needs.
 *
 * Two kinds of reader, differing in where their reach comes from:
 *
 *   platform admin  CFOSME staff. Every client, by role. No grants, because a
 *                   grant per client would need re-issuing for every client
 *                   onboarded and would silently go stale if it were not.
 *   member          Everyone else. Exactly the clients on their grant list, and
 *                   editable only where that grant says EDIT.
 */

export type TaskScope = {
  user: SessionUser;
  /** True for CFOSME staff, who read across clients. */
  isPractice: boolean;
  /**
   * The clients this reader may see, or null when they may see all of them.
   * Null is not "none" — it is the platform admin's unrestricted case, and the
   * distinction is what keeps `taskScopeFilter` honest.
   */
  visibleClientIds: string[] | null;
  /** The granted clients, for the client slicer. Empty for a platform admin. */
  grants: GrantedClient[];
};

/**
 * The `where` fragment every task query starts from.
 *
 * `requested` is what the URL asked for, and it is only ever allowed to *narrow*.
 * A member who asks for a client they hold no grant to gets their own grant list
 * instead of that client, so a hand-edited `?client=` can never widen what they
 * see. A member with no grants at all gets a filter that matches nothing, which
 * is the correct reading of "granted nothing" — and is why this returns an empty
 * `in` list rather than an unfiltered query.
 */
export function taskScopeFilter(
  scope: TaskScope,
  requested?: string | null,
): { clientId?: string | { in: string[] } } {
  const allowed = scope.visibleClientIds;

  // Platform admin: one client, or all of them.
  if (allowed === null) {
    return requested ? { clientId: requested } : {};
  }

  if (requested && allowed.includes(requested)) {
    return { clientId: requested };
  }

  return { clientId: { in: allowed } };
}

/** May this reader move tasks belonging to this client? */
export function canEditClient(scope: TaskScope, clientId: string): boolean {
  if (scope.isPractice) return true;
  return scope.grants.some(
    (grant) => grant.id === clientId && grant.level === "EDIT",
  );
}

/**
 * The clients this reader may edit, or null for no restriction.
 *
 * A set rather than a boolean because a member can hold EDIT on one client and
 * VIEW on another, so the register decides its controls row by row.
 */
export function editableClientIds(scope: TaskScope): Set<string> | null {
  if (scope.isPractice) return null;
  return new Set(
    scope.grants.filter((grant) => grant.level === "EDIT").map((grant) => grant.id),
  );
}

/** True when the reader may edit at least one of the clients they can see. */
export function canEditAnything(scope: TaskScope): boolean {
  if (scope.isPractice) return true;
  return scope.grants.some((grant) => grant.level === "EDIT");
}

/**
 * What this reader is looking at, in words — for the page heading.
 *
 * A member with one grant sees that client's name, which is what they would call
 * it. With several, a count, because listing four company names in a subheading
 * is noise. Nothing here is load-bearing; the filtering is done above.
 */
export function scopeLabel(scope: TaskScope): string {
  if (scope.isPractice) return "All clients";
  if (scope.grants.length === 0) return "No clients";
  if (scope.grants.length === 1) return scope.grants[0]!.name;
  return `${scope.grants.length} clients`;
}

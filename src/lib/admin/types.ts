/**
 * Shared shape for the admin form actions.
 *
 * This lives outside actions.ts on purpose: a "use server" module may only
 * export async functions, so the initial-state constant cannot sit beside the
 * actions that use it. That rule is enforced at runtime rather than at build
 * time, so the failure shows up as a 500 on first use.
 */

export type AdminState = {
  error: string | null;
  success: string | null;
  /** Shown once, never stored in readable form. */
  temporaryPassword?: string;
  /** Set when a new client is created, so the caller can link to it. */
  clientId?: string;
};

export const INITIAL_ADMIN_STATE: AdminState = { error: null, success: null };

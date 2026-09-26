"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Feedback, Submit } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { CONTROL, cn } from "@/components/ui/primitives";
import { revokeSessionsAction, setRoleAction } from "@/lib/admin/access-actions";
import {
  resetPasswordAction,
  toggleUserActiveAction,
} from "@/lib/admin/actions";
import { INITIAL_ADMIN_STATE, type AdminState } from "@/lib/admin/types";

/**
 * The controls on one account's page that are not about client access.
 *
 * Client access itself is the editor in access-editor.tsx — one list, one save.
 * It used to be four separate forms here, and moving it out is what let this
 * file shrink to the three things that genuinely are separate decisions: the
 * role, the password, and where the account is signed in.
 */

/** A one-line failure, for controls that sit in a table row. */
function InlineError({ state }: { state: AdminState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-tone-bad">
      {state.error}
    </p>
  );
}

/** Promote to CFOSME staff, or demote back to a member. */
export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState(setRoleAction, INITIAL_ADMIN_STATE);
  const next = role === "PLATFORM_ADMIN" ? "MEMBER" : "PLATFORM_ADMIN";

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {role === "PLATFORM_ADMIN"
          ? "CFOSME staff read every client and can manage clients, logins and imports. Demoting removes that and leaves the account with no client access until you grant some."
          : "A member sees only the clients granted to them. Promoting to CFOSME staff gives every client and the administration screens, and removes the per-client grants as redundant."}
      </p>
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="role" value={next} />
        <Submit
          label={next === "PLATFORM_ADMIN" ? "Make CFOSME staff" : "Demote to member"}
          pendingLabel="Saving…"
          variant="outline"
        />
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Password reset and deactivation — the account, not its access. */
export function AccountForms({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [resetState, resetAction] = useActionState(
    resetPasswordAction,
    INITIAL_ADMIN_STATE,
  );
  const [toggleState, toggleAction] = useActionState(
    toggleUserActiveAction,
    INITIAL_ADMIN_STATE,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={resetAction}>
          <input type="hidden" name="userId" value={userId} />
          <Submit label="Reset password" pendingLabel="Resetting…" variant="outline" />
        </form>

        {!isSelf && (
          <form action={toggleAction}>
            <input type="hidden" name="userId" value={userId} />
            <Submit
              label={isActive ? "Deactivate account" : "Reactivate account"}
              pendingLabel="Saving…"
              variant={isActive ? "ghost" : "outline"}
            />
          </form>
        )}
      </div>

      {isSelf && (
        <p className="text-xs text-muted-foreground">
          This is your own account, so it cannot be deactivated here.
        </p>
      )}

      <Feedback state={resetState} />
      <Feedback state={toggleState} />
    </div>
  );
}

/** End one session, or all of them. */
export function SessionForms({
  userId,
  sessionId,
}: {
  userId: string;
  /** Omitted for the "sign out everywhere" button. */
  sessionId?: string;
}) {
  const [state, action] = useActionState(
    revokeSessionsAction,
    INITIAL_ADMIN_STATE,
  );

  if (sessionId) {
    return (
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <SessionSubmit />
        <InlineError state={state} />
      </form>
    );
  }

  return (
    <div className="space-y-1.5">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <Submit
          label="Sign out everywhere"
          pendingLabel="Signing out…"
          variant="outline"
        />
      </form>
      <Feedback state={state} />
    </div>
  );
}

function SessionSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="ghost"
      size="lg"
      disabled={pending}
      className={cn(CONTROL, "h-8 text-xs")}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Feedback, Submit } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { CONTROL, cn } from "@/components/ui/primitives";
import {
  removeUserAction,
  restoreUserAction,
  revokeSessionsAction,
  setRoleAction,
} from "@/lib/admin/access-actions";
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

/**
 * Removing an account, and bringing it back.
 *
 * Two deliberate choices here, and the first one I got wrong the first time.
 *
 * It is styled as destructive. Nothing is deleted — the audit trail, the tasks
 * this account moved and the access it held all survive — and I originally took
 * that to mean the control should not look alarming. That was reasoning about
 * the database rather than about the person: to whoever is removed, this ends
 * their access immediately and without warning, and a control with that
 * consequence should look like it. "Reversible by an administrator" is not the
 * same as "harmless".
 *
 * And it asks before it acts. The button reveals a confirmation naming the
 * person and stating exactly what happens and what is kept, so the destructive
 * click is never the first one and never lands on the wrong row of a list of
 * similar-looking accounts. It is a two-step confirm rather than type-the-name,
 * because removal *is* undoable — type-to-confirm is the right friction for
 * something that cannot be undone, and using it here would train people to type
 * names without reading.
 */
export function RemovalForms({
  userId,
  userName,
  isRemoved,
  removedAt,
  removedByName,
  grantCount,
  isSelf,
}: {
  userId: string;
  userName: string;
  isRemoved: boolean;
  removedAt: string | null;
  removedByName: string | null;
  grantCount: number;
  isSelf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removeState, removeAction] = useActionState(
    removeUserAction,
    INITIAL_ADMIN_STATE,
  );
  const [restoreState, restoreAction] = useActionState(
    restoreUserAction,
    INITIAL_ADMIN_STATE,
  );

  if (isSelf) {
    return (
      <p className="text-xs text-muted-foreground">
        This is your own account, so it cannot be removed here.
      </p>
    );
  }

  if (isRemoved) {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Removed{removedAt ? ` ${removedAt}` : ""}
          {removedByName ? ` by ${removedByName}` : ""}. Nothing was deleted —
          the audit trail, the tasks this account moved, the workbook imports it
          ran and its {grantCount} client grant
          {grantCount === 1 ? "" : "s"} are all still here. Restoring puts it back
          exactly as it was.
        </p>
        <form action={restoreAction}>
          <input type="hidden" name="userId" value={userId} />
          <Submit label="Restore account" pendingLabel="Restoring…" variant="outline" />
        </form>
        <Feedback state={restoreState} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        For somebody who is only away, use <b>Deactivate</b> above — it blocks
        sign-in but leaves them listed. Removal is for somebody who has gone.
      </p>

      {confirming ? (
        <div
          role="group"
          aria-label={`Confirm removing ${userName}`}
          className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
        >
          <p className="text-sm font-semibold text-destructive">
            Remove {userName}?
          </p>
          <ul className="list-disc space-y-1 ps-5 text-xs leading-relaxed text-foreground">
            <li>They are signed out immediately and cannot sign in again.</li>
            <li>They disappear from the portal except under <b>Removed</b>.</li>
            <li>
              Kept: the audit trail, every task they moved, the imports they ran
              {grantCount > 0
                ? `, and their ${grantCount} client grant${grantCount === 1 ? "" : "s"}`
                : ""}
              .
            </li>
            <li>You can restore the account at any time.</li>
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <form action={removeAction}>
              <input type="hidden" name="userId" value={userId} />
              <Submit
                label={`Yes, remove ${userName}`}
                pendingLabel="Removing…"
                variant="destructive"
              />
            </form>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="lg"
          onClick={() => setConfirming(true)}
        >
          Remove account
        </Button>
      )}

      <Feedback state={removeState} />
    </div>
  );
}

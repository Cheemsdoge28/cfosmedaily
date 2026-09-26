"use client";

import { useActionState } from "react";

import {
  Feedback,
  Field,
  SelectField,
  Submit,
} from "@/components/admin/form-bits";
import {
  grantAccessAction,
  grantAllClientsAction,
  revokeAccessAction,
  revokeAllAccessAction,
  revokeSessionsAction,
  setRoleAction,
} from "@/lib/admin/access-actions";
import {
  resetPasswordAction,
  toggleUserActiveAction,
} from "@/lib/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/types";

/**
 * The controls on one person's access page.
 *
 * Each is its own form over its own server action, so a failure is reported
 * beside the control that caused it rather than at the top of the page. That
 * matters here more than elsewhere: this screen has eight separate operations on
 * it, and a single shared message panel would leave a reader guessing which one
 * a "success" belonged to.
 */

const LEVEL_OPTIONS = [
  { value: "VIEW", label: "View only" },
  { value: "EDIT", label: "Can edit — may move tasks" },
];

/** Add a client to this person, or change the level of one they already hold. */
export function GrantAccessForm({
  userId,
  clients,
}: {
  userId: string;
  /** Clients not yet granted. Empty once they hold all of them. */
  clients: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(grantAccessAction, INITIAL_ADMIN_STATE);

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This person already has access to every active client. Change a level, or
        remove one, in the table above.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field label="Client">
          <SelectField
            name="clientId"
            ariaLabel="Client to grant"
            defaultValue={clients[0]!.id}
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            className="w-full"
          />
        </Field>

        <Field label="Level">
          <SelectField
            name="level"
            ariaLabel="Access level"
            defaultValue="VIEW"
            options={LEVEL_OPTIONS}
            className="w-full"
          />
        </Field>

        <Submit label="Grant access" pendingLabel="Granting…" />
      </div>

      <Feedback state={state} />
    </form>
  );
}

/** Change the level of an existing grant, from its own row. */
export function ChangeLevelForm({
  userId,
  clientId,
  level,
}: {
  userId: string;
  clientId: string;
  level: string;
}) {
  const [state, action] = useActionState(grantAccessAction, INITIAL_ADMIN_STATE);
  const next = level === "EDIT" ? "VIEW" : "EDIT";

  return (
    <div className="space-y-1.5">
      <form action={action} className="inline">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="level" value={next} />
        <Submit
          label={next === "EDIT" ? "Allow editing" : "Make view only"}
          pendingLabel="Saving…"
          variant="outline"
        />
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Remove one client from this person. */
export function RevokeAccessForm({
  userId,
  clientId,
}: {
  userId: string;
  clientId: string;
}) {
  const [state, action] = useActionState(revokeAccessAction, INITIAL_ADMIN_STATE);

  return (
    <div className="space-y-1.5">
      <form action={action} className="inline">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="clientId" value={clientId} />
        <Submit label="Remove" pendingLabel="Removing…" variant="ghost" />
      </form>
      <Feedback state={state} />
    </div>
  );
}

/**
 * The two bulk operations.
 *
 * Kept together and visually apart from the per-client table, because they are
 * the ones worth thinking twice about. "Grant every client" is a snapshot, and
 * the action's own message says so rather than letting an operator assume it
 * keeps up with new clients.
 */
export function BulkAccessForms({ userId }: { userId: string }) {
  const [grantState, grantAction] = useActionState(
    grantAllClientsAction,
    INITIAL_ADMIN_STATE,
  );
  const [revokeState, revokeAction] = useActionState(
    revokeAllAccessAction,
    INITIAL_ADMIN_STATE,
  );

  return (
    <div className="space-y-4">
      <form action={grantAction} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            label="Grant every active client at this level"
            hint="A snapshot of the clients that exist now — later ones are not added automatically. Existing levels are left alone."
          >
            <SelectField
              name="level"
              ariaLabel="Level for every client"
              defaultValue="VIEW"
              options={LEVEL_OPTIONS}
              className="w-full"
            />
          </Field>
          <Submit
            label="Grant all"
            pendingLabel="Granting…"
            variant="outline"
          />
        </div>
        <Feedback state={grantState} />
      </form>

      <form action={revokeAction} className="space-y-2 border-t border-border pt-4">
        <input type="hidden" name="userId" value={userId} />
        <p className="text-xs text-muted-foreground">
          Removes every client from this account and signs them out. The account
          itself stays, with nothing to see until something is granted again.
        </p>
        <Submit
          label="Remove all access"
          pendingLabel="Removing…"
          variant="ghost"
        />
        <Feedback state={revokeState} />
      </form>
    </div>
  );
}

/** Promote to CFOSME staff, or demote back to a member. */
export function RoleForm({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const [state, action] = useActionState(setRoleAction, INITIAL_ADMIN_STATE);
  const next = role === "PLATFORM_ADMIN" ? "MEMBER" : "PLATFORM_ADMIN";

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {role === "PLATFORM_ADMIN"
          ? "CFOSME staff read every client and can manage clients, logins and imports. Demoting removes that and leaves the account with no client access until you grant some."
          : "A member sees only the clients granted below. Promoting to CFOSME staff gives every client and the administration screens, and removes the per-client grants as redundant."}
      </p>
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="role" value={next} />
        <Submit
          label={
            next === "PLATFORM_ADMIN"
              ? "Make CFOSME staff"
              : "Demote to member"
          }
          pendingLabel="Saving…"
          variant="outline"
        />
      </form>
      <Feedback state={state} />
    </div>
  );
}

/** Password reset and deactivation, which belong to the account not its access. */
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
          <Submit
            label="Reset password"
            pendingLabel="Resetting…"
            variant="outline"
          />
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

  return (
    <div className="space-y-1.5">
      <form action={action} className="inline">
        <input type="hidden" name="userId" value={userId} />
        {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
        <Submit
          label={sessionId ? "Sign out" : "Sign out everywhere"}
          pendingLabel="Signing out…"
          variant={sessionId ? "ghost" : "outline"}
        />
      </form>
      <Feedback state={state} />
    </div>
  );
}

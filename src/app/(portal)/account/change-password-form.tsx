"use client";

import { useActionState } from "react";

import { Field, Input, Submit } from "@/components/admin/form-bits";
import { Callout } from "@/components/ui/primitives";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/lib/auth/actions";

const INITIAL: ChangePasswordState = { error: null, success: false };

/**
 * Uses the same field, button and panel pieces as the admin forms rather than
 * its own copies — it had drifted to a different label weight and its own
 * spinner, which is the sort of thing a reader notices without being able to
 * say why.
 */
export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, INITIAL);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <PasswordField
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
      />
      <PasswordField
        id="newPassword"
        label="New password"
        autoComplete="new-password"
        hint="At least 12 characters, with upper and lower case, a digit and a symbol."
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
      />

      {state.error && <Callout tone="bad">{state.error}</Callout>}
      {state.success && (
        <Callout tone="good">
          Password changed. All other devices have been signed out.
        </Callout>
      )}

      <Submit label="Change password" pendingLabel="Saving…" />
    </form>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input
        id={id}
        name={id}
        type="password"
        required
        autoComplete={autoComplete}
      />
    </Field>
  );
}

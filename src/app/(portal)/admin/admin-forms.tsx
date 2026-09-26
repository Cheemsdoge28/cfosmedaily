"use client";

import { useActionState } from "react";

import {
  Feedback,
  Field,
  Input,
  SelectField,
  Submit,
} from "@/components/admin/form-bits";
import {
  createClientAction,
  createUserAction,
  resetPasswordAction,
  toggleClientActiveAction,
  toggleUserActiveAction,
  updateUserRoleAction,
} from "@/lib/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/types";

/**
 * The administration forms.
 *
 * Every one is a `useActionState` pair over a server action, so the result — an
 * error, a confirmation, a temporary password shown once — comes back through the
 * same `Feedback` component and reads the same way on each.
 */

/**
 * Add a client.
 *
 * Most clients never come through here: the workbook importer creates them from
 * the Client column the first time it meets a name. This is for the cases it
 * cannot cover — someone who needs a login before their tasks exist.
 */
export function CreateClientForm() {
  const [state, action] = useActionState(createClientAction, INITIAL_ADMIN_STATE);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Client name"
          hint="Must match the Client column in the workbook exactly — that is what imports match on."
        >
          <Input name="name" required placeholder="Benchmark LLC" />
        </Field>

        <Field
          label="Short name"
          hint="Used in this client's web address. Lowercase letters, digits and hyphens."
        >
          <Input name="slug" required pattern="[a-z0-9\-]{2,40}" placeholder="benchmark-llc" />
        </Field>

        <Field label="Legal name" hint="Optional — for correspondence.">
          <Input name="legalName" placeholder="Benchmark Advisory LLC" />
        </Field>
      </div>

      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">
          First login <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Someone at the client who can sign in and see their own register. You can
          also add people later, from the logins table above.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input name="adminName" placeholder="Priya Sharma" />
          </Field>
          <Field label="E-mail address">
            <Input name="adminEmail" type="email" placeholder="finance@benchmark.example" />
          </Field>
        </div>
      </fieldset>

      <Feedback state={state} />

      <div>
        <Submit label="Add client" pendingLabel="Adding…" />
      </div>
    </form>
  );
}

/** Give someone at a client a login. */
export function CreateUserForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(createUserAction, INITIAL_ADMIN_STATE);

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a client first — a login has to belong to one.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client">
          <SelectField
            name="clientId"
            ariaLabel="Client"
            defaultValue={clients[0]!.id}
            options={clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
            className="w-full"
          />
        </Field>

        <Field label="Access">
          <SelectField
            name="role"
            ariaLabel="Access level"
            defaultValue="VIEWER"
            options={[
              { value: "VIEWER", label: "Viewer — read-only" },
              { value: "CLIENT_ADMIN", label: "Client administrator — may edit tasks" },
            ]}
            className="w-full"
          />
        </Field>

        <Field label="Full name">
          <Input name="name" required placeholder="Priya Sharma" />
        </Field>

        <Field label="E-mail address">
          <Input name="email" type="email" required placeholder="finance@benchmark.example" />
        </Field>
      </div>

      <Feedback state={state} />

      <div>
        <Submit label="Create login" pendingLabel="Creating…" />
      </div>
    </form>
  );
}

/**
 * The per-row controls on the logins table.
 *
 * One form per action rather than a menu: each is a single button whose label says
 * exactly what it does, which is what you want beside a list of people's accounts.
 */
export function UserRowActions({
  userId,
  role,
  isActive,
  isSelf,
}: {
  userId: string;
  role: string;
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
  const [roleState, roleAction] = useActionState(
    updateUserRoleAction,
    INITIAL_ADMIN_STATE,
  );

  const nextRole = role === "CLIENT_ADMIN" ? "VIEWER" : "CLIENT_ADMIN";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={roleAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="role" value={nextRole} />
          <Submit
            label={role === "CLIENT_ADMIN" ? "Make viewer" : "Make administrator"}
            pendingLabel="Saving…"
            variant="outline"
          />
        </form>

        <form action={resetAction}>
          <input type="hidden" name="userId" value={userId} />
          <Submit label="Reset password" pendingLabel="Resetting…" variant="outline" />
        </form>

        {!isSelf && (
          <form action={toggleAction}>
            <input type="hidden" name="userId" value={userId} />
            <Submit
              label={isActive ? "Deactivate" : "Reactivate"}
              pendingLabel="Saving…"
              variant={isActive ? "ghost" : "outline"}
            />
          </form>
        )}
      </div>

      <Feedback state={roleState} />
      <Feedback state={resetState} />
      <Feedback state={toggleState} />
    </div>
  );
}

/** Suspend a client, or bring one back. A suspended register is read-only. */
export function ClientActiveToggle({
  clientId,
  isActive,
}: {
  clientId: string;
  isActive: boolean;
}) {
  const [state, action] = useActionState(
    toggleClientActiveAction,
    INITIAL_ADMIN_STATE,
  );

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="clientId" value={clientId} />
        <Submit
          label={isActive ? "Suspend" : "Reactivate"}
          pendingLabel="Saving…"
          variant={isActive ? "ghost" : "outline"}
        />
      </form>
      <Feedback state={state} />
    </div>
  );
}

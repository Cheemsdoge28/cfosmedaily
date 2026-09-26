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
  toggleClientActiveAction,
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

/**
 * Create a login.
 *
 * A login is no longer owned by a client, so the client field is optional: an
 * account can be created now and granted its clients on its own page. That is
 * the normal path for a CFOSME reviewer who covers several, and it is why this
 * form offers one client rather than pretending there is only ever one.
 */
export function CreateUserForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(createUserAction, INITIAL_ADMIN_STATE);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="name" required placeholder="Priya Sharma" />
        </Field>

        <Field label="E-mail address">
          <Input
            name="email"
            type="email"
            required
            placeholder="finance@benchmark.example"
          />
        </Field>

        <Field
          label="First client"
          hint="Optional. Add more, or change the level, on their access page."
        >
          <SelectField
            name="clientId"
            ariaLabel="First client"
            defaultValue="none"
            options={[
              { value: "none", label: "None — grant clients later" },
              ...clients.map((client) => ({
                value: client.id,
                label: client.name,
              })),
            ]}
            className="w-full"
          />
        </Field>

        <Field label="Level for that client">
          <SelectField
            name="level"
            ariaLabel="Access level"
            defaultValue="VIEW"
            options={[
              { value: "VIEW", label: "View only" },
              { value: "EDIT", label: "Can edit — may move tasks" },
            ]}
            className="w-full"
          />
        </Field>
      </div>

      <Feedback state={state} />

      <div>
        <Submit label="Create login" pendingLabel="Creating…" />
      </div>
    </form>
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

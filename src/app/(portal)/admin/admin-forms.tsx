"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  Feedback,
  Field,
  Input,
  MONTHS,
  Submit,
} from "@/components/admin/form-bits";
import { ButtonLink } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClientAction } from "@/lib/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/types";

/**
 * Step 1 of onboarding: create the client.
 *
 * This deliberately does more than insert one row. A client is only usable once
 * it has business units and fiscal years — the dashboard resolves its filters
 * against fiscal years, and a Zoho sync refuses any month that no fiscal year
 * covers. Offering the first login here too means one form takes a new client
 * from nothing to someone who can sign in.
 */
export function CreateClientForm() {
  const [state, action] = useActionState(createClientAction, INITIAL_ADMIN_STATE);
  const router = useRouter();

  // On success, move the operator on to the client's own page, where Zoho and
  // any further logins are set up. The temporary password stays on screen.
  useEffect(() => {
    if (state.clientId && !state.temporaryPassword) {
      router.push(`/admin/clients/${state.clientId}`);
    }
  }, [state.clientId, state.temporaryPassword, router]);

  const currentYear = new Date().getUTCFullYear();

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client name">
          <Input
            name="name"
            required
            placeholder="Acme Manufacturing Pvt Ltd"
          />
        </Field>

        <Field
          label="Short name"
          hint="Used in this client’s web address. Lowercase letters, digits and hyphens."
        >
          <Input
            name="slug"
            required
            pattern="[a-z0-9\-]{2,40}"
            placeholder="acme"
          />
        </Field>

        <Field label="Currency" hint="INR is presented in lakhs and crores.">
          <Input
            name="currency"
            required
            defaultValue="INR"
            maxLength={3}
          />
        </Field>

        <Field
          label="Financial year starts in"
          hint="April for Indian companies."
        >
          <Select name="fiscalYearStartMonth" defaultValue="4">
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) => MONTHS[Number(value) - 1] ?? "Select"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, index) => (
                <SelectItem key={month} value={String(index + 1)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Business units"
          hint="Comma separated. Leave blank for a single consolidated unit."
        >
          <Input
            name="businessUnits"
            placeholder="Manufacturing, Trading"
          />
        </Field>

        <Field
          label="Financial years to set up"
          hint={`Counting back from the year containing ${currentYear}. Two gives a prior year to compare against.`}
        >
          <Select name="historyYears" defaultValue="2">
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) =>
                  Number(value) === 1
                    ? "1 — current year only"
                    : Number(value) === 2
                      ? "2 — current and prior year"
                      : `${value} years`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — current year only</SelectItem>
              <SelectItem value="2">2 — current and prior year</SelectItem>
              <SelectItem value="3">3 years</SelectItem>
              <SelectItem value="4">4 years</SelectItem>
              <SelectItem value="5">5 years</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">
          First login <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Someone at the client who can sign in straight away and add their
          own colleagues. You can also add people later, from the
          client&rsquo;s own page.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input name="adminName" placeholder="Priya Sharma" />
          </Field>
          <Field label="E-mail address">
            <Input
              name="adminEmail"
              type="email"
              placeholder="cfo@acme.example"
            />
          </Field>
        </div>
      </fieldset>

      <Feedback state={state} />

      {state.clientId && state.temporaryPassword && (
        <ButtonLink
          size="lg"
          render={<a href={`/admin/clients/${state.clientId}`} />}
        >
          Continue to the client &rarr;
        </ButtonLink>
      )}

      <div>
        <Submit label="Create client" pendingLabel={"Creating…"} />
      </div>
    </form>
  );
}

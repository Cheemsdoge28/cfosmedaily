"use client";

import { useActionState } from "react";

import { Feedback, Field, Input, Submit } from "@/components/admin/form-bits";
import { importWorkbookAction } from "@/lib/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/types";

/**
 * The upload form.
 *
 * Two fields, and the second one is the interesting one.
 *
 * The workbook's Due Date column mixes real dates with text an operator typed —
 * "20th Sept", "3rd Sept" — which carry a day but no month or year. Something has
 * to supply those, and taking them from the clock would mean the same file
 * imported in October produced different deadlines than it did in September. So
 * the month the register covers is asked for explicitly, defaulted to this one,
 * and stated on the form so it is never a hidden assumption.
 */
export function ImportForm() {
  const [state, action] = useActionState(importWorkbookAction, INITIAL_ADMIN_STATE);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Workbook"
          hint="The .xlsx file, with its Tasks sheet. Up to 8 MB."
        >
          <Input
            name="workbook"
            type="file"
            required
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            // File inputs are taller than the portal's 36px control at their
            // default padding, so the button gets its own spacing.
            className="h-auto py-1.5 file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-secondary-foreground"
          />
        </Field>

        <Field
          label="Month this workbook covers"
          hint="Fixes what a due date written as '20th Sept' means. Dates already written in full are unaffected."
        >
          <Input name="period" type="month" required defaultValue={thisMonth} />
        </Field>
      </div>

      <Feedback state={state} />

      <div>
        <Submit label="Import workbook" pendingLabel="Importing…" />
      </div>
    </form>
  );
}

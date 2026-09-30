"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Input as BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout, CONTROL, cn } from "@/components/ui/primitives";
import {
  Select as BaseSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminState } from "@/lib/admin/types";

/**
 * The admin forms are built from these and nothing else.
 *
 * They exist because the same four decisions — control height, label weight,
 * where the hint goes, how a result is announced — were being made again on
 * every form, and had come out differently on each. Everything here carries
 * the portal's one control height, so a text field, a select and a submit
 * button line up on the same baseline without any form having to arrange it.
 */

export { Label };

/** The portal's input, at the shared control height. */
export function Input({
  className,
  ...props
}: React.ComponentProps<typeof BaseInput>) {
  return <BaseInput className={cn(CONTROL, className)} {...props} />;
}

/**
 * A labelled select.
 *
 * Base UI's `SelectValue` renders the raw value unless it is given a
 * formatter, which is how the role field came to read "VIEWER" instead of
 * "Viewer — read-only". Taking the options as data means the label and the
 * formatter cannot disagree.
 */
export function SelectField({
  name,
  defaultValue,
  options,
  ariaLabel,
  className,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <BaseSelect name={name} defaultValue={defaultValue}>
      <SelectTrigger aria-label={ariaLabel} className={cn(CONTROL, className)}>
        <SelectValue>
          {(value) =>
            options.find((option) => option.value === String(value))?.label ??
            String(value)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </BaseSelect>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        // Indented to where the control's own text begins — its padding plus
        // its border — so the label sits over the value rather than a step to
        // the left of it.
        className="ps-[calc(--spacing(2.5)+1px)] text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {hint && (
        <p className="ps-[calc(--spacing(2.5)+1px)] text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A control with its button beside it.
 *
 * The button used to be a flex sibling of the whole field, so `items-end`
 * aligned it to the bottom of the hint rather than the bottom of the input,
 * and it hung below the control it belonged to. Here the row holds the
 * control and the button, and the hint sits underneath both.
 */
export function InlineField({
  label,
  hint,
  control,
  action,
  className,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
  action: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="ps-[calc(--spacing(2.5)+1px)] text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{control}</div>
        <div className="shrink-0">{action}</div>
      </div>
      {hint && (
        <p className="ps-[calc(--spacing(2.5)+1px)] text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Feedback({ state }: { state: AdminState }) {
  return (
    <>
      {state.error && <Callout tone="bad">{state.error}</Callout>}
      {state.success && <Callout tone="good">{state.success}</Callout>}
      {state.temporaryPassword && (
        <TemporaryPassword value={state.temporaryPassword} />
      )}
    </>
  );
}

/**
 * A temporary password is displayed once and never stored in readable form, so
 * it is called out rather than tucked into the success message.
 */
export function TemporaryPassword({ value }: { value: string }) {
  return (
    <Callout tone="warn" className="grid-cols-[auto_1fr] gap-x-2">
      <Icons.shield className="size-4" />
      <div className="col-start-2">
        <p className="text-xs font-bold tracking-wide uppercase">
          Temporary password &mdash; shown once
        </p>
        <code className="mt-1 block font-mono text-sm break-all select-all">
          {value}
        </code>
        <p className="mt-1 text-xs opacity-90">
          Send it over a secure channel, separately from the e-mail address. The
          user must change it at first sign-in.
        </p>
      </div>
    </Callout>
  );
}

export function Submit({
  label,
  pendingLabel,
  variant = "default",
  className,
}: {
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      variant={variant}
      className={className}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

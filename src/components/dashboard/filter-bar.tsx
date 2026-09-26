"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTROL } from "@/components/ui/primitives";
import { ALL, type FilterOption, type ResolvedFilters } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

/** The portal's one control height, plus the bar's full-width columns. */
const FILTER_CONTROL = cn(CONTROL, "w-full");

/**
 * The five slicers.
 *
 * Filter state lives in the URL, so a filtered view is shareable, survives a
 * refresh, is what the Print/PDF button captures, and is what the register links
 * from the dashboard carry.
 *
 * Each option shows how many tasks it would leave given everything else already
 * selected — the count is computed against the other four slicers, not against the
 * whole register. That is the difference between a count that guides a reader and
 * one that walks them into an empty table.
 */
export function FilterBar({ filters }: { filters: ResolvedFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      // ALL is the "no filter" sentinel — Base UI's Select cannot hold an empty
      // string as a value, so it round-trips through the URL as an absent param.
      if (value && value !== ALL) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function reset() {
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        // Sticky under the header, which is what earns it the glass: on a long
        // register the slicers stay reachable and the rows scroll beneath them
        // rather than behind an opaque slab.
        //
        // Only from xl, where the six controls fit on one row. Narrower than that
        // they stack two or three deep, and pinning a 140px band to the top of a
        // phone costs more of the screen than the slicers are worth.
        "no-print animate-rise mb-4 rounded-[var(--radius-card)] p-4",
        "xl:sticky xl:top-16 xl:z-20",
        "glass border border-border/70",
        // A grid, not flex-wrap: six fixed-width fields wrapping at their own
        // discretion leave one field orphaned beside a gap at laptop widths.
        "grid grid-cols-2 items-end gap-x-4 gap-y-3",
        "sm:grid-cols-3 xl:grid-cols-6",
        "transition-opacity duration-200",
        isPending && "pointer-events-none opacity-60",
      )}
      aria-busy={isPending}
    >
      <Field label="Client" htmlFor="slicer-client">
        <Slicer
          id="slicer-client"
          value={filters.clientId}
          allLabel="All clients"
          options={filters.clients}
          disabled={filters.clientLocked}
          onChange={(value) => update({ client: value })}
        />
      </Field>

      <Field label="Owner" htmlFor="slicer-owner">
        <Slicer
          id="slicer-owner"
          value={filters.owner}
          allLabel="All owners"
          options={filters.owners}
          onChange={(value) => update({ owner: value })}
        />
      </Field>

      <Field label="Process" htmlFor="slicer-process">
        <Slicer
          id="slicer-process"
          value={filters.process}
          allLabel="All processes"
          options={filters.processes}
          onChange={(value) => update({ process: value })}
        />
      </Field>

      <Field label="Status" htmlFor="slicer-status">
        <Slicer
          id="slicer-status"
          value={filters.status}
          allLabel="All statuses"
          options={filters.statuses}
          onChange={(value) => update({ status: value })}
        />
      </Field>

      <Field label="Frequency" htmlFor="slicer-frequency">
        <Slicer
          id="slicer-frequency"
          value={filters.frequency}
          allLabel="All frequencies"
          options={filters.frequencies}
          onChange={(value) => update({ freq: value })}
        />
      </Field>

      {/* Two and three-column layouts leave this one orphaned beside a gap, so it
          takes the rest of the row until every field fits on one. */}
      <div className="col-span-2 sm:col-span-3 xl:col-span-1">
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          // Nothing to reset is worth saying rather than hiding: a control that
          // appears and disappears is one a reader has to hunt for.
          disabled={filters.activeCount === 0}
          className={cn(CONTROL, "w-full")}
        >
          {filters.activeCount === 0
            ? "No filters"
            : `Reset ${filters.activeCount} filter${filters.activeCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

/**
 * One slicer.
 *
 * The count rides in the menu but never in the trigger: "Rupali Sharma 41" in a
 * closed control reads as part of the name, and the KPI row above already says how
 * many tasks are in view.
 */
function Slicer({
  id,
  value,
  allLabel,
  options,
  disabled = false,
  onChange,
}: {
  id: string;
  value: string;
  allLabel: string;
  options: FilterOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const selected = value || ALL;

  return (
    <Select
      value={selected}
      disabled={disabled}
      onValueChange={(next) => next && onChange(String(next))}
    >
      <SelectTrigger id={id} className={FILTER_CONTROL}>
        <SelectValue>
          {(current) =>
            current === ALL
              ? allLabel
              : (options.find((option) => option.value === current)?.label ?? allLabel)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex w-full items-center justify-between gap-4">
              <span className="truncate">{option.label}</span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums text-muted-foreground",
                  // An option that would empty the table still selectable, but
                  // visibly a dead end.
                  option.count === 0 && "opacity-60",
                )}
              >
                {option.count}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label
        htmlFor={htmlFor}
        // Indented to where the control's own text begins — its 10px padding plus
        // the 1px border. Flush left, the labels sat a clear step to the left of
        // the values they name and the bar read as two ragged columns.
        className="ps-[calc(--spacing(2.5)+1px)] text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

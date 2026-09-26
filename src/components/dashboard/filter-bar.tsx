"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CONTROL } from "@/components/ui/primitives";
import { ALL_UNITS, type ResolvedFilters } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

/** The portal's one control height, plus the bar's full-width columns. */
const FILTER_CONTROL = cn(CONTROL, "w-full");

/**
 * The four dashboard filters.
 *
 * Filter state lives in the URL, so a filtered view is shareable, survives a
 * refresh and is what the Print/PDF button captures. Changing a filter pushes
 * new search params; the server components re-query from them.
 *
 * Built on shadcn's Select and ToggleGroup rather than native controls, so the
 * menus are themed in dark mode, the keyboard behaviour is Base UI's, and the bar
 * looks the same on every platform.
 */
export function FilterBar({ filters }: { filters: ResolvedFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        // Sticky under the header, which is what earns it the glass: on a
        // long statement the filters stay reachable, and the figures scroll
        // beneath them rather than behind an opaque slab.
        //
        // Only from xl, where the five fields fit on one row. Narrower than
        // that they stack two or three deep, and pinning a 140px band to the
        // top of a phone costs more of the screen than the filters are worth.
        "no-print animate-rise mb-4 rounded-[var(--radius-card)] p-4",
        // Directly under the header, inside the panel's own scrollport.
        "xl:sticky xl:top-16 xl:z-20",
        "glass border border-border/70",
        // A grid, not flex-wrap. Five fixed-width fields wrapping at their own
        // discretion put Currency alone on a second row at exactly the widths
        // a laptop uses; columns wrap predictably instead.
        "grid grid-cols-2 items-start gap-x-4 gap-y-3",
        "sm:grid-cols-3 xl:grid-cols-5",
        "transition-opacity duration-200",
        isPending && "pointer-events-none opacity-60",
      )}
      aria-busy={isPending}
    >
      <Field label="Period" htmlFor="filter-fy">
        <Select
          value={filters.fiscalYear.id}
          onValueChange={(value) => value && update({ fy: value, month: "" })}
        >
          <SelectTrigger id="filter-fy" className={FILTER_CONTROL}>
            <SelectValue>
              {(value) =>
                filters.fiscalYears.find((fy) => fy.id === value)?.label ??
                filters.fiscalYear.label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {filters.fiscalYears.map((fy) => (
              <SelectItem key={fy.id} value={fy.id}>
                {fy.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="View">
        <ToggleGroup
          // Base UI models a toggle group as a set, so the single selection is
          // an array of one. Clicking the active item empties it, and the
          // dashboard always has a view mode, so an empty value is ignored.
          value={[filters.viewMode]}
          onValueChange={(value) => {
            const next = value[0];
            if (next) update({ view: next });
          }}
          spacing={0}
          className={cn(CONTROL, TRACK, "w-full")}
        >
          <ToggleGroupItem value="monthly" className={SEGMENT}>
            Monthly
          </ToggleGroupItem>
          <ToggleGroupItem value="ytd" className={SEGMENT}>
            YTD
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      <Field
        label={filters.viewMode === "ytd" ? "YTD through" : "Month"}
        htmlFor="filter-month"
      >
        <Select
          value={filters.month.value}
          onValueChange={(value) => value && update({ month: value })}
        >
          <SelectTrigger id="filter-month" className={FILTER_CONTROL}>
            <SelectValue>
              {(value) =>
                filters.months.find((month) => month.value === value)?.label ??
                filters.month.label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {filters.months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Business Unit" htmlFor="filter-unit">
        <Select
          value={filters.businessUnitId}
          onValueChange={(value) => value && update({ unit: value })}
        >
          <SelectTrigger id="filter-unit" className={FILTER_CONTROL}>
            <SelectValue>
              {(value) =>
                value === ALL_UNITS
                  ? "All Units"
                  : (filters.businessUnits.find((unit) => unit.id === value)
                      ?.name ?? "All Units")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_UNITS}>All Units</SelectItem>
            {filters.businessUnits.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Two and three-column layouts both leave this one orphaned beside a
          gap, so it takes the rest of the row until every field fits on one. */}
      <Field
        label="Currency"
        htmlFor="filter-currency"
        className="col-span-2 sm:col-span-1 xl:col-span-1"
      >
        <Select value={filters.currency} disabled>
          <SelectTrigger id="filter-currency" className={FILTER_CONTROL}>
            <SelectValue>{() => filters.currency}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={filters.currency}>{filters.currency}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

/**
 * The view toggle, built as a segmented control rather than two joined
 * buttons.
 *
 * The selected segment is a pill floating inside a recessed track, and the
 * two corners are concentric: the track is `--radius-lg` with 3px of padding,
 * so the pill takes `--radius-lg` minus 3px and the two arcs stay parallel
 * instead of crossing. The pill used to fill the track corner to corner with
 * square inner edges, which is what made it read as a pair of buttons.
 *
 * Base UI marks the pressed item with `aria-pressed`, not `data-state="on"` —
 * a Radix convention that does nothing here. shadcn's own toggle already
 * styles `aria-pressed` as a faint `bg-muted`; these carry `!` because they
 * override that rule at equal specificity.
 */
const TRACK = cn(
  "rounded-lg border border-input bg-muted/70 p-[3px]",
  "shadow-[inset_0_1px_2px_rgb(16_35_63_/_0.06)]",
  "dark:bg-input/40 dark:shadow-[inset_0_1px_2px_rgb(0_0_0_/_0.25)]",
);

const SEGMENT = cn(
  // The track is --radius-lg with a 1px border and 3px of padding, so the
  // segment sits 4px in and takes that radius minus 4. The `!` is needed
  // because shadcn's own `rounded-none` and `first:rounded-l-lg` for a
  // zero-spacing group are more specific than a plain arbitrary class.
  "h-full flex-1 rounded-[calc(var(--radius-lg)-4px)]! border-0 bg-transparent",
  "text-sm font-medium text-muted-foreground",
  "transition-[background-color,color,box-shadow] duration-200",
  "hover:bg-transparent hover:text-foreground",
  "aria-pressed:bg-card! aria-pressed:text-heading!",
  "aria-pressed:shadow-[0_1px_2px_rgb(16_35_63_/_0.10),0_2px_6px_-2px_rgb(16_35_63_/_0.12)]",
  "dark:aria-pressed:bg-card! dark:aria-pressed:shadow-[0_1px_2px_rgb(0_0_0_/_0.4)]",
);

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        // Indented to where the control's own text begins — its 10px padding
        // plus the 1px border. Flush left, the labels sat a clear step to the
        // left of the values they name and the bar read as two ragged columns.
        className="ps-[calc(--spacing(2.5)+1px)] text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CONTROL, cn } from "@/components/ui/primitives";

/**
 * A segmented control: one choice out of a few, shown as a pill in a track.
 *
 * This exists because the same control had been hand-rolled twice — once for the
 * user filters, once for the access editor — as `<button>`s with their own
 * padding and their own radius. Both came out a different height from the search
 * field beside them, which is the kind of thing that reads as "unfinished" long
 * before anyone can say why.
 *
 * Two details it gets right that a hand-rolled version does not:
 *
 *   height     it is the portal's one control height, so it lines up with an
 *              Input or a Button on the same row without anyone arranging it.
 *
 *   corners    the track is `--radius-lg` with a 1px border and 3px of padding,
 *              so the pill inside takes that radius *minus 4px*. Two rounded
 *              shapes only look like one object when they share a centre of
 *              curvature; give the pill the track's own radius and the two arcs
 *              visibly cross. This is the same derivation the rest of the
 *              portal's nested corners use.
 *
 * Base UI models a toggle group as a set, so a single selection is an array of
 * one, and clicking the active item would empty it — which is why an empty value
 * is ignored rather than treated as a deselection.
 */

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Shown after the label, dimmed — a count, usually. */
  hint?: string | number;
};

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined;
        if (picked) onValueChange(picked);
      }}
      spacing={0}
      aria-label={ariaLabel}
      className={cn(CONTROL, TRACK, className)}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className={SEGMENT}>
          {option.label}
          {option.hint !== undefined && (
            <span className="ms-1.5 tabular-nums opacity-65">{option.hint}</span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const TRACK = cn(
  "inline-flex rounded-lg border border-input bg-muted/70 p-[3px]",
  "shadow-[inset_0_1px_2px_rgb(16_35_63_/_0.06)]",
  "dark:bg-input/40 dark:shadow-[inset_0_1px_2px_rgb(0_0_0_/_0.25)]",
);

const SEGMENT = cn(
  // The track is --radius-lg with a 1px border and 3px of padding, so the
  // segment sits 4px in and takes that radius minus 4. The `!` is needed because
  // shadcn's own `rounded-none` and `first:rounded-l-lg` for a zero-spacing group
  // are more specific than a plain arbitrary class.
  "h-full rounded-[calc(var(--radius-lg)-4px)]! border-0 bg-transparent px-3",
  "text-xs font-medium whitespace-nowrap text-muted-foreground",
  "transition-[background-color,color,box-shadow] duration-200",
  "hover:bg-transparent hover:text-foreground",
  "aria-pressed:bg-card! aria-pressed:text-heading!",
  "aria-pressed:shadow-[0_1px_2px_rgb(16_35_63_/_0.10),0_2px_6px_-2px_rgb(16_35_63_/_0.12)]",
  "dark:aria-pressed:bg-card! dark:aria-pressed:shadow-[0_1px_2px_rgb(0_0_0_/_0.4)]",
);

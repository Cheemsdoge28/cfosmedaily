import { Badge } from "@/components/ui/primitives";
import { formatPercent, pluralTasks } from "@/lib/tasks/format";
import type { GroupRollup } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

/**
 * Completion by client.
 *
 * A list of bars rather than a chart, because there are eighteen clients and the
 * reader's question is "who is behind", not "what is the distribution". A bar
 * chart with eighteen categories needs scrolling and a legend to answer the same
 * thing this answers by being sorted.
 *
 * Weakest first — the rollup sorts that way — so the client who needs attention is
 * never below the fold.
 *
 * The figure is the mean progress of the client's tasks, not the share that are
 * finished. Four tasks all at 90% is a client nearly done; "0% complete" would be
 * technically true and useless.
 */
export function CompletionBars({
  data,
  limit = 12,
}: {
  data: GroupRollup[];
  limit?: number;
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No clients match the current filters.
      </p>
    );
  }

  const rows = data.slice(0, limit);
  const hidden = data.length - rows.length;

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium text-foreground" title={row.label}>
              {row.label}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {row.overdue > 0 && (
                <Badge tone="bad" title={`${pluralTasks(row.overdue)} past their due date`}>
                  {row.overdue} overdue
                </Badge>
              )}
              <span className="text-sm font-semibold tabular-nums text-heading">
                {formatPercent(row.completion)}
              </span>
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-3">
            {/* The track is the meter; the label above is its value. Not a
                `<progress>` element, which cannot be restyled consistently
                across browsers — so the ARIA role is stated explicitly. */}
            <div
              role="meter"
              aria-label={`${row.label} completion`}
              aria-valuenow={row.completion}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  // A client with overdue work is not "doing well at 80%", so the
                  // bar says so. Colour is never the only signal — the overdue
                  // count is spelled out in the pill beside it.
                  row.overdue > 0
                    ? "bg-[var(--negative)]"
                    : row.completion >= 100
                      ? "bg-[var(--positive)]"
                      : "bg-[var(--progress)]",
                )}
                style={{ width: `${Math.max(row.completion, 1)}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {row.done}/{row.total} done
            </span>
          </div>
        </div>
      ))}

      {hidden > 0 && (
        <p className="pt-1 text-xs text-muted-foreground">
          {hidden} further {hidden === 1 ? "client" : "clients"} not shown — narrow
          the view with the slicers above, or open the task register.
        </p>
      )}
    </div>
  );
}

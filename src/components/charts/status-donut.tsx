"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  tooltipLabelStyle,
  tooltipStyle,
  useChartPalette,
} from "@/components/charts/chart-tokens";
import { formatPercent } from "@/lib/tasks/format";
import type { StatusSlice } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

/**
 * The status mix, as a donut with an attached legend.
 *
 * A donut answers "what shape is the month in" at a glance, which is the question
 * this card is asked, and five is few enough segments to stay tellable apart.
 *
 * It is kept honest in the ways that matter: the slice order is the register's
 * fixed status order rather than largest-first, so the shape of a good month and a
 * bad one are comparable; identity is never colour alone, because the legend names
 * every state and carries its count; and a 2px ring of the surface colour sits
 * between slices, which is what stops two adjacent hues reading as one arc.
 */
export function StatusDonut({ data }: { data: StatusSlice[] }) {
  const palette = useChartPalette();

  // Zero-count states are dropped from the ring but kept in the legend: a slice
  // of nothing is invisible anyway, whereas "Blocked 0" is worth reading.
  const slices = data.filter((slice) => slice.count > 0);
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No tasks match the current filters.
      </p>
    );
  }

  return (
    // A container query, not a viewport one: this card is half width on the
    // dashboard and full width on a narrow screen, and at half width a legend
    // beside the donut was squeezed to "In pro…", "Not st…".
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @md:flex-row">
        <div className="group/donut relative h-54 w-full max-w-[13.5rem] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                // The centre total sits after the chart in the DOM and would
                // otherwise paint over the tooltip.
                wrapperStyle={{ zIndex: 30 }}
                contentStyle={tooltipStyle(palette)}
                labelStyle={tooltipLabelStyle(palette)}
                formatter={(value: unknown, name: unknown) => [
                  `${Number(value)} of ${total} · ${formatPercent(
                    total ? (Number(value) / total) * 100 : 0,
                  )}`,
                  String(name),
                ]}
              />
              <Pie
                data={slices}
                dataKey="count"
                nameKey="label"
                innerRadius="58%"
                outerRadius="92%"
                paddingAngle={2}
                stroke={palette.surface}
                strokeWidth={2}
                animationDuration={520}
                animationEasing="ease-out"
              >
                {slices.map((slice) => (
                  <Cell key={slice.status} fill={palette.status[slice.status]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* The total belongs in the hole, not as a sixth label. It steps aside
              while a slice is hovered so the tooltip is never obscured. */}
          <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center transition-opacity duration-150 group-hover/donut:opacity-0">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Tasks
            </span>
            <span className="text-2xl leading-7 font-semibold tabular-nums text-heading">
              {total}
            </span>
          </div>
        </div>

        <ul className="w-full min-w-0 space-y-1.5">
          {data.map((slice) => {
            const share = total ? (slice.count / total) * 100 : 0;
            return (
              <li
                key={slice.status}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs",
                  "transition-colors hover:bg-muted",
                  // A state with nothing in it recedes rather than disappearing.
                  slice.count === 0 && "opacity-55",
                )}
              >
                <span
                  aria-hidden="true"
                  // The legend row is --radius-md with 8px of side padding, so
                  // the swatch takes that radius less 8px.
                  className="size-2.5 shrink-0 rounded-[calc(var(--radius-md)-0.5rem)]"
                  style={{ backgroundColor: palette.status[slice.status] }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {slice.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatPercent(share)}
                </span>
                <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-heading">
                  {slice.count}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

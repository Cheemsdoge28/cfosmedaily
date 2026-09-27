"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { categoryTick } from "@/components/charts/axis";
import {
  AXIS_FONT,
  tooltipLabelStyle,
  tooltipStyle,
  useChartPalette,
} from "@/components/charts/chart-tokens";
import type { GroupRollup } from "@/lib/tasks/types";

/**
 * Who is carrying what.
 *
 * The card this replaces was captioned "task volume and completion" and plotted
 * only volume, so the one thing a reader wanted — is the person with thirty tasks
 * on top of them or drowning? — was not on it. Each bar is therefore split into
 * what is finished and what is still open, which is the same total and answers
 * both questions at once.
 *
 * Horizontal, because the labels are people's names: rotated vertical tick labels
 * are unreadable, and a name has no natural abbreviation.
 *
 * One axis, counting tasks. Completion is a share of the same bar rather than a
 * second scale, so nothing here invites a comparison the data does not support.
 */
export function WorkloadChart({ data }: { data: GroupRollup[] }) {
  const palette = useChartPalette();

  if (data.length === 0) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">
        No tasks match the current filters.
      </p>
    );
  }

  // Busiest at the top. The rollup itself sorts by completion, which is right for
  // the client bars but reads oddly on a workload chart.
  const rows = [...data].sort((a, b) => b.total - a.total).slice(0, 12);

  // Tall enough for its rows rather than a fixed height: two owners in a 240px
  // box produce two very fat bars with a void beneath them.
  const height = Math.max(160, rows.length * 44 + 56);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 34, bottom: 0, left: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid stroke={palette.grid} strokeWidth={1} horizontal={false} />
          <XAxis
            type="number"
            // Counts are whole numbers; the default tick generator happily
            // offers 2.5 tasks.
            allowDecimals={false}
            tick={{ fill: palette.tick, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={{ stroke: palette.grid }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={132}
            interval={0}
            // Same reason as the process chart: a wrapped category label is not
            // given room by Recharts, so a long name overlaps the row below.
            tick={categoryTick({ fill: palette.tick, maxChars: 17 })}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
            contentStyle={tooltipStyle(palette)}
            labelStyle={tooltipLabelStyle(palette)}
            formatter={(value, name) => [`${Number(value)} tasks`, name]}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: palette.tick }}
          />
          <Bar
            dataKey="done"
            name="Completed"
            stackId="workload"
            fill={palette.status.DONE}
            // The 2px surface ring is what keeps the two segments from reading
            // as one bar where they meet.
            stroke={palette.surface}
            strokeWidth={2}
            radius={[4, 0, 0, 4]}
            maxBarSize={30}
            animationDuration={520}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="open"
            name="Still open"
            stackId="workload"
            fill={palette.status.NOT_STARTED}
            stroke={palette.surface}
            strokeWidth={2}
            radius={[0, 4, 4, 0]}
            maxBarSize={30}
            animationDuration={520}
            animationEasing="ease-out"
          >
            {/* The total, at the end of the bar. Not a number on every segment —
                the tooltip carries the split, and two labels inside a 30px bar
                collide as soon as one segment is small. */}
            <LabelList
              dataKey="total"
              position="right"
              offset={8}
              className="fill-muted-foreground"
              style={{ fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

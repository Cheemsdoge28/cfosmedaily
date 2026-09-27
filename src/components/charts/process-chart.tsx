"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
 * Where the month's work is concentrated.
 *
 * One series, so there is no legend: the card title names what the bars count,
 * and a legend box for a single measure is furniture. Each bar carries its figure
 * directly instead, which is what a reader would otherwise get by squinting at the
 * axis.
 *
 * One hue throughout, and deliberately not a status hue. Process names are
 * nominal — Accounting is not more or less than Compliance — so painting each bar
 * a different colour would imply a categorical scheme that means nothing. And
 * painting them all the blue that means "In progress" would imply these tasks
 * were in progress, which is a different and worse kind of wrong: the bar counts
 * tasks in every state.
 */
export function ProcessChart({ data }: { data: GroupRollup[] }) {
  const palette = useChartPalette();

  if (data.length === 0) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">
        No tasks match the current filters.
      </p>
    );
  }

  const MAX_BARS = 8;
  const sorted = [...data].sort((a, b) => b.total - a.total);

  // Past the cap the tail becomes one bar rather than a chart nobody can read.
  const rows =
    sorted.length <= MAX_BARS
      ? sorted
      : [
          ...sorted.slice(0, MAX_BARS - 1),
          {
            key: "other",
            label: `Other (${sorted.length - MAX_BARS + 1})`,
            total: sorted
              .slice(MAX_BARS - 1)
              .reduce((sum, row) => sum + row.total, 0),
            done: 0,
            open: 0,
            overdue: 0,
            completion: 0,
          },
        ];

  const height = Math.max(160, rows.length * 34 + 40);

  // Process names are the practice's own wording and run long — "Sales Report &
  // Budget Vs Actuals report" is one of them — so the ticks are drawn as single
  // lines and clipped. See categoryTick for why truncation alone was not enough.

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 30, bottom: 0, left: 0 }}
          barCategoryGap="26%"
        >
          <CartesianGrid stroke={palette.grid} strokeWidth={1} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: palette.tick, fontSize: AXIS_FONT }}
            tickLine={false}
            axisLine={{ stroke: palette.grid }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            // Every category gets a tick: Recharts otherwise drops some when it
            // thinks they will not fit, which on a bar chart leaves unlabelled bars.
            interval={0}
            tick={categoryTick({ fill: palette.tick, maxChars: 20 })}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
            contentStyle={tooltipStyle(palette)}
            labelStyle={tooltipLabelStyle(palette)}
            // The label is the full process name, so the tooltip is where a
            // truncated tick becomes readable again.
            formatter={(value) => [`${Number(value)} tasks`, "Tasks"]}
          />
          <Bar
            dataKey="total"
            fill={palette.neutralBar}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            animationDuration={520}
            animationEasing="ease-out"
          >
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

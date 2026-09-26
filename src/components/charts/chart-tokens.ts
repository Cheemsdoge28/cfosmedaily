"use client";

import { useTheme } from "@/components/theme/theme";
import type { TaskStatus } from "@/generated/prisma/enums";

/**
 * Chart colours.
 *
 * Recharts needs literal colour values — it interpolates fills and strokes, so a
 * `var(--chart-1)` would not animate and would break in an exported image. These
 * therefore mirror the CSS tokens rather than referencing them, and are re-read
 * whenever the theme flips.
 *
 * Rules the chart components follow:
 *   - one y-axis, never two;
 *   - colour follows the entity, so filtering never repaints a series;
 *   - nominal categories get one hue, ordered bands get the ordinal ramp;
 *   - categorical hues are assigned in fixed order and never cycled.
 *
 * The categorical and ordinal palettes were validated against the card surface
 * with the data-viz checker:
 *
 *   series pair, light   adjacent CVD ΔE 24.7, normal-vision ΔE 33.6, both >= 3:1
 *   series pair, dark    adjacent CVD ΔE 26.8, normal-vision ΔE 31.8, both >= 3:1
 *   ordinal ramp, both   monotone lightness, adjacent ΔL >= 0.06, single hue
 */

export type ChartPalette = {
  series: [string, string];
  /** Fixed categorical order. Past six, fold the tail into "Other". */
  categorical: string[];
  ordinal: string[];
  /** One colour per task state. See STATUS_FILL below for why it is separate. */
  status: Record<TaskStatus, string>;
  grid: string;
  tick: string;
  surface: string;
};

/**
 * The status palette.
 *
 * Deliberately not drawn from the categorical slots. A task's state is *semantic*
 * — green means finished, red means stuck — so these hues carry meaning and are
 * reserved for it; using slot 3 for "At risk" would let a later chart paint an
 * unrelated series the same amber.
 *
 * That semantics constrains the palette in a way a nominal one is not: green,
 * amber and red are close in hue by definition, and "Not started" must read as
 * the absence of a state, which means grey. So it was validated on the pairlist
 * that actually matters for a donut — adjacent slices, in the order they are
 * drawn — and on that list both modes pass every check:
 *
 *   light, on #ffffff   adjacent CVD ΔE 19.9, normal-vision ΔE 20.9, all >= 3:1
 *   dark,  on #141d2e   adjacent CVD ΔE 10.1, normal-vision ΔE 16.4, all >= 3:1
 *
 * The one check each mode fails is the chroma floor, on "Not started" alone, and
 * that failure is the intent: a grey that cleared the floor would no longer read
 * as "nothing has happened yet". Identity is never left to colour — every slice
 * is named and carries its count in the legend beside it.
 */
const STATUS_LIGHT: Record<TaskStatus, string> = {
  DONE: "#12855a",
  IN_PROGRESS: "#2a78d6",
  AT_RISK: "#c08a00",
  BLOCKED: "#96201f",
  NOT_STARTED: "#8593a8",
};

const STATUS_DARK: Record<TaskStatus, string> = {
  DONE: "#199e70",
  IN_PROGRESS: "#2f6fd6",
  AT_RISK: "#c98500",
  BLOCKED: "#cf4040",
  NOT_STARTED: "#878fa0",
};

const LIGHT: ChartPalette = {
  series: ["#2a78d6", "#eb6834"],
  categorical: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6845d8", "#e87ba4"],
  ordinal: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"],
  status: STATUS_LIGHT,
  grid: "#eef1f5",
  tick: "#667085",
  surface: "#ffffff",
};

const DARK: ChartPalette = {
  series: ["#3987e5", "#d95926"],
  categorical: ["#3987e5", "#d95926", "#199e70", "#c98500", "#9085e9", "#d55181"],
  ordinal: ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"],
  status: STATUS_DARK,
  grid: "#22304a",
  tick: "#94a3b8",
  surface: "#141d2e",
};

/** Derived straight from the theme — there is no state to keep in step. */
export function useChartPalette(): ChartPalette {
  const { resolved } = useTheme();
  return resolved === "dark" ? DARK : LIGHT;
}

/** Shared tooltip chrome, themed. */
export function tooltipStyle(palette: ChartPalette) {
  return {
    borderRadius: 10,
    border: `1px solid ${palette.grid}`,
    background: palette.surface,
    boxShadow: "0 8px 24px rgb(16 35 63 / 0.14)",
    fontSize: 12,
    padding: "8px 10px",
  } as const;
}

export function tooltipLabelStyle(palette: ChartPalette) {
  return {
    color: palette.tick,
    fontWeight: 600,
    marginBottom: 4,
  } as const;
}

export const AXIS_FONT = 11;

"use client";

import { useTheme } from "@/components/theme/theme";

/**
 * Chart colours.
 *
 * Recharts needs literal colour values — it interpolates fills and strokes, so
 * a `var(--chart-1)` would not animate and would break in an exported image.
 * These therefore mirror the CSS tokens rather than referencing them, and are
 * re-read whenever the theme flips.
 *
 * Every palette here was checked with the data-viz validator against the card
 * surface it sits on, rather than picked by eye:
 *
 *   series pair, light   adjacent CVD ΔE 24.7, normal-vision ΔE 33.6, both >= 3:1
 *   series pair, dark    adjacent CVD ΔE 26.8, normal-vision ΔE 31.8, both >= 3:1
 *   ordinal ramp, both   monotone lightness, adjacent ΔL >= 0.06, single hue
 *
 * Rules the chart components follow:
 *   - one y-axis, never two;
 *   - colour follows the entity, so filtering never repaints a series;
 *   - nominal categories get one hue, ordered bands get the ordinal ramp;
 *   - categorical hues are assigned in fixed order and never cycled.
 */

export type ChartPalette = {
  series: [string, string];
  /** Fixed categorical order. Past six, fold the tail into "Other". */
  categorical: string[];
  ordinal: string[];
  grid: string;
  tick: string;
  surface: string;
};

const LIGHT: ChartPalette = {
  series: ["#2a78d6", "#eb6834"],
  categorical: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6845d8", "#e87ba4"],
  ordinal: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"],
  grid: "#eef1f5",
  tick: "#667085",
  surface: "#ffffff",
};

const DARK: ChartPalette = {
  series: ["#3987e5", "#d95926"],
  categorical: ["#3987e5", "#d95926", "#199e70", "#c98500", "#9085e9", "#d55181"],
  ordinal: ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"],
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

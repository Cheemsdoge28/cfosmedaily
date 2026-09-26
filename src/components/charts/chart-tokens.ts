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
 * There are exactly two palettes here, because the charts draw exactly two kinds
 * of thing. The set carried over from the portal this was forked from also held a
 * six-hue categorical ramp and a five-step ordinal ramp, both unused — and both
 * carrying a comment asserting they had been validated against these surfaces.
 * Dead values with a correctness claim on them are worse than no values, because
 * the next person reaches for one and trusts the claim, so they are gone.
 */

export type ChartPalette = {
  /**
   * Magnitude with no state attached — the Process Mix bars.
   *
   * Drawn from the brand's own deep teal rather than from any status hue. That
   * is the point of it: a bar counting tasks per process means "how many", and
   * painting it the same blue as "In progress" would quietly imply those tasks
   * were in progress. Structural, not semantic.
   *
   * Light 6.0:1 on #ffffff, dark 5.5:1 on #141d2e.
   */
  neutralBar: string;
  /** One colour per task state. See the note below for why it is its own set. */
  status: Record<TaskStatus, string>;
  grid: string;
  tick: string;
  surface: string;
};

/**
 * The status palette.
 *
 * Reserved by meaning: green is finished, red is stuck, and these five are never
 * reused as a series colour, or an unrelated amber bar would read as "at risk".
 *
 * Being semantic constrains it in a way a nominal palette is not — green, amber
 * and red are close in hue by definition, and "Not started" has to read as the
 * absence of a state, which means grey. So it is validated on the pairlist that
 * actually matters for a donut: adjacent slices, in the order they are drawn. On
 * that list both modes pass every check.
 *
 *   light, on #ffffff   adjacent CVD ΔE 15.1, normal-vision ΔE 16.1, all >= 3:1
 *   dark,  on #141d2e   adjacent CVD ΔE 10.1, normal-vision ΔE 16.4, all >= 3:1
 *
 * The one check each mode fails is the chroma floor, on "Not started" alone, and
 * that failure is the intent: a grey that cleared the floor would stop reading as
 * "nothing has happened yet". Identity is never left to colour — every slice is
 * named and carries its count in the legend beside it.
 *
 * "In progress" is the brand's blue rather than the inherited one, which is what
 * makes the charts look like they belong to this product; re-validated at that
 * hue rather than assumed to still pass.
 */
const STATUS_LIGHT: Record<TaskStatus, string> = {
  DONE: "#12855a",
  IN_PROGRESS: "#1b8ec4",
  AT_RISK: "#c08a00",
  BLOCKED: "#96201f",
  NOT_STARTED: "#8593a8",
};

const STATUS_DARK: Record<TaskStatus, string> = {
  DONE: "#17915f",
  IN_PROGRESS: "#2f9fd0",
  AT_RISK: "#c98500",
  BLOCKED: "#cf4040",
  NOT_STARTED: "#878fa0",
};

const LIGHT: ChartPalette = {
  neutralBar: "#1f6b84",
  status: STATUS_LIGHT,
  grid: "#eef1f5",
  tick: "#667085",
  surface: "#ffffff",
};

const DARK: ChartPalette = {
  neutralBar: "#4f9cb8",
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
    // --radius-md, matching the popovers and menus this sits among.
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

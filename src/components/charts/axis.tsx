"use client";

import { AXIS_FONT } from "@/components/charts/chart-tokens";

/**
 * A category tick that is guaranteed to be one line.
 *
 * Recharts renders axis labels through its own `Text`, which is given the axis
 * width and wraps on any space that does not fit. Truncating the string first
 * does not prevent it: "Debtors Outstandi…" still contains a space, so it still
 * broke across two lines and overlapped the row beneath.
 *
 * So the tick is drawn directly instead — one `<text>`, no wrapping logic, and
 * the string clipped to what the gutter holds. The full name stays in the
 * tooltip, which is where a reader goes when a label is not enough.
 */
export function categoryTick({
  fill,
  maxChars,
}: {
  fill: string;
  maxChars: number;
}) {
  function shorten(value: string): string {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, maxChars - 1).trimEnd()}…`;
  }

  // Recharts passes the tick its resolved position and payload.
  return function CategoryTick(props: unknown) {
    const { x, y, payload } = props as {
      x: number;
      y: number;
      payload: { value: string };
    };

    const label = String(payload?.value ?? "");

    return (
      <text
        x={x}
        y={y}
        // The tick's y is the band's centre; dy nudges the baseline onto it.
        dy={4}
        textAnchor="end"
        fill={fill}
        fontSize={AXIS_FONT}
      >
        <title>{label}</title>
        {shorten(label)}
      </text>
    );
  };
}

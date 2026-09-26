import { Icons, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * The headline figures at the top of every module.
 *
 * These were six saturated gradient cards, one hue per metric. Revenue and
 * EBITDA are not categories of anything — the colour carried no meaning, it
 * just made five unrelated numbers shout at once, and the same icon appeared
 * under three different hues on the ageing views.
 *
 * So they are ordinary surfaces now, and colour says exactly one thing: which
 * way a figure moved. The metric is the label, the number is the number, and
 * the only tint is on the delta and the icon that belongs to it.
 */

export type KpiTone = "neutral" | "positive" | "negative";

export type KpiCardProps = {
  label: string;
  value: string;
  caption?: string;
  captionTone?: KpiTone;
  icon: IconName;
  /** Retained so callers need not change; no longer selects a colour. */
  variant?: number;
};

const CAPTION_TONE: Record<KpiTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-[var(--positive)]",
  negative: "text-[var(--negative)]",
};

const ICON_TONE: Record<KpiTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-[var(--tone-good-bg)] text-[var(--tone-good-fg)]",
  negative: "bg-[var(--tone-bad-bg)] text-[var(--tone-bad-fg)]",
};

export function KpiCard({
  label,
  value,
  caption,
  captionTone = "neutral",
  icon,
}: KpiCardProps) {
  const Icon = Icons[icon];

  return (
    <div
      className={cn(
        "animate-rise flex min-w-0 flex-col justify-between gap-3 rounded-[var(--radius-card)]",
        "border border-border bg-card p-4",
        "transition-[border-color] duration-200 hover:border-foreground/15",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Two lines are reserved whether or not this label needs them:
            "Days Sales Outstanding" wraps where "Revenue" does not, and a
            row of figures that starts at two different heights reads as a
            mistake even when the cards themselves line up. */}
        <p className="min-w-0 min-h-8 text-xs leading-4 font-medium text-balance text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            ICON_TONE[captionTone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>

      <div className="min-w-0">
        <p className="truncate text-2xl leading-7 font-semibold tracking-tight tabular-nums text-heading">
          {value}
        </p>
        {caption && (
          <p
            // Captions are short but not always one line at narrow widths;
            // clamping keeps the card height stable without cutting a word
            // mid-flight the way a single-line truncate does.
            className={cn(
              "mt-1 line-clamp-2 text-xs leading-4",
              CAPTION_TONE[captionTone],
            )}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

/** The KPI row. Five or six cards depending on the module. */
export function KpiRow({ items }: { items: KpiCardProps[] }) {
  return (
    <div
      className={cn(
        "grid items-stretch gap-3",
        // One card per column below 420px — two 150px cards cannot hold a
        // label, a figure in lakhs and a caption without all three wrapping.
        "grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3",
        items.length >= 6 ? "xl:grid-cols-6" : "xl:grid-cols-5",
      )}
    >
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}

import {
  Alert as ShadAlert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Card as ShadCard,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table as ShadTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * The design system.
 *
 * Every screen is built from the pieces below, so spacing, type and colour are
 * decided once rather than per page. The rules they encode:
 *
 *   Type      five steps only — 2xl page title, base card title, sm body,
 *             xs label, and tabular-nums for anything numeric. No arbitrary
 *             pixel sizes; the previous interface had twelve.
 *   Rhythm    cards sit in a `space-y-4` stack, never carrying their own
 *             bottom margin, so a page cannot drift out of step.
 *   Padding   one card header (px-5 py-3.5) and one card body (p-5).
 *   Colour    surfaces and borders come from the theme tokens. Colour is
 *             reserved for meaning — a tone on a figure or a pill — and is
 *             never decoration.
 *   Numbers   right-aligned and tabular everywhere, so columns of figures
 *             line up on the decimal.
 */

export { cn };

/**
 * One height for every form control on the portal: 36px.
 *
 * shadcn's Input and Button are 32px and its Select trigger sets its own
 * height through `data-[size=default]:h-8`, which outranks a plain `h-9` —
 * matching that selector is what makes the override stick. The admin forms
 * and the dashboard filter bar had drifted to different heights because each
 * solved this separately; they now import the same string.
 */
export const CONTROL = "h-9 data-[size=default]:h-9";

/** Vertical rhythm for a page. Children never set their own bottom margin. */
export function Stack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

/** A row of cards that keeps them the same height. */
export function Row({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid items-stretch gap-4", className)}>{children}</div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Drops body padding, for a card whose content is a full-bleed table. */
  flush?: boolean;
}) {
  return (
    <ShadCard
      className={cn(
        "animate-rise h-full gap-0 overflow-hidden py-0",
        "transition-[border-color,box-shadow] duration-200 hover:border-foreground/15",
        className,
      )}
    >
      {(title || action) && (
        <CardHeader className="gap-0 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {title && (
              <CardTitle className="truncate text-base leading-6 font-semibold tracking-tight text-heading">
                {title}
              </CardTitle>
            )}
            {description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn(flush ? "p-0" : "p-5", bodyClassName)}>
        {children}
      </CardContent>
    </ShadCard>
  );
}

export type BadgeTone = "good" | "warn" | "bad" | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  good: "tone-good",
  warn: "tone-warn",
  bad: "tone-bad",
  neutral: "tone-neutral",
};

/**
 * Status pill.
 *
 * Deliberately not shadcn's primary/secondary scale: these carry accounting
 * meaning (healthy / watch / action), and that is the one thing colour is
 * allowed to say here.
 */
export function Badge({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  /** Hover text, for a pill whose label is a friendlier form of a stored value. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Tables scroll rather than squash, and the first column is the only one that
 * takes the slack — otherwise the browser spreads every column evenly and
 * leaves acres between a label and its figure.
 */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    // min-w-0 so that a wrapper placed in a grid or flex column can actually
    // shrink: without it the track widens to the table's 32rem instead of the
    // table scrolling, and everything beside it is pushed off the card.
    <div className="w-full min-w-0 overflow-x-auto">
      <div className="min-w-[32rem]">{children}</div>
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <ShadTable className="text-sm">{children}</ShadTable>;
}

/**
 * The head, body and rows.
 *
 * These exist because the pages were writing `<thead>`, `<tbody>` and `<tr>`
 * by hand. That looks harmless and is not: every rule shadcn puts on a table
 * row — the hairline between rows, the hover tint, the suppressed border on
 * the last one — is attached to `TableRow` and `TableBody`, so a raw `<tr>`
 * got none of it and the tables read as floating columns of text.
 */
export function THead({ children }: { children: React.ReactNode }) {
  return <TableHeader>{children}</TableHeader>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <TableBody>{children}</TableBody>;
}

export function Tr({
  children,
  highlight = false,
  className,
}: {
  children: React.ReactNode;
  /**
   * A subtotal line. The tint goes on the cells rather than the row, because
   * a `<tr>` cannot be rounded — `border-radius` on a table row is ignored,
   * which is why the highlighted bands used to run to the card edge with
   * square corners. On the cells it clips, so the band reads as a pill.
   */
  highlight?: boolean;
  className?: string;
}) {
  return (
    <TableRow
      data-highlight={highlight || undefined}
      className={cn(
        // A hairline drawn hard against a rounded corner is the thing that
        // gives a pill away: the rule crosses the curve and the band stops
        // looking detached. So the highlighted row drops its own separator,
        // and the row above drops the one it would draw into the top corners.
        "has-[+tr[data-highlight]]:border-b-0",
        highlight && [
          "border-b-0",
          "[&>td]:bg-accent [&>td]:font-semibold [&>td]:text-heading",
          "[&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg",
          "hover:[&>td]:bg-accent",
        ],
        className,
      )}
    >
      {children}
    </TableRow>
  );
}

export function Th({
  children,
  align = "left",
  grow = false,
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  /** The label column: takes the leftover width so figures stay together. */
  grow?: boolean;
  className?: string;
}) {
  return (
    <TableHead
      className={cn(
        "h-9 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase",
        align === "right" ? "text-right" : "text-left",
        grow ? "w-full" : "whitespace-nowrap",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

export function Td({
  children,
  align = "left",
  strong = false,
  muted = false,
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  strong?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <TableCell
      className={cn(
        "px-3 py-2.5 tabular-nums",
        align === "right" ? "text-right" : "text-left",
        strong && "font-semibold text-heading",
        muted && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </TableCell>
  );
}

/** The heading every page opens with. */
export function PageHeading({
  title,
  description,
  meta,
  action,
}: {
  title: string;
  description?: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight text-heading">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {meta && (
          <p className="mt-1 text-xs font-medium text-muted-foreground">{meta}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A labelled figure, used wherever a card lists supporting values. */
export function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="animate-rise rounded-[var(--radius-card)] border border-dashed border-border bg-card px-5 py-14 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/** Inline note under a card's content — provenance, caveats, method. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * A panel that reports state — a warning, a failure, a confirmation.
 *
 * Built on shadcn's Alert so the layout is the same wherever one appears, and
 * toned from the same four tokens as Badge. That shared source is what stops a
 * warning being amber-50 on one page and amber-100 on the next, and is why
 * these read correctly in dark mode: the raw Tailwind palette classes they
 * replaced were light-theme values with no dark counterpart.
 */
export function Callout({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: BadgeTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <ShadAlert
      className={cn("border-transparent px-3 py-2.5", TONE_CLASS[tone], className)}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && (
        <AlertDescription className="text-inherit opacity-90">
          {children}
        </AlertDescription>
      )}
    </ShadAlert>
  );
}

/**
 * The one-line result of a form action.
 *
 * Carries the right ARIA live role for its tone — a failure is announced,
 * a confirmation is polite — so screen-reader behaviour does not depend on
 * each caller remembering to set it.
 */
export function FormMessage({
  tone,
  children,
  className,
}: {
  tone: "good" | "bad";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={cn(
        "text-xs",
        tone === "bad" ? "text-tone-bad" : "text-tone-good",
        className,
      )}
    >
      {children}
    </p>
  );
}

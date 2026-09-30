import { POLICY_UPDATED } from "@/lib/site";

/**
 * The shared typography for a legal document.
 *
 * One component rather than the same Tailwind classes retyped on three pages,
 * because the thing that goes wrong with policy pages is that they drift into
 * three slightly different documents.
 */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <h1 className="text-3xl leading-9 font-semibold tracking-tight text-heading">
        {title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {summary}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Last reviewed {POLICY_UPDATED}
      </p>

      <div
        className={[
          "mt-8 space-y-6",
          "[&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-heading",
          "[&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-heading",
          "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground",
          "[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-foreground",
          "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:ps-5",
          "[&_a]:font-medium [&_a]:text-heading [&_a]:underline [&_a]:underline-offset-2",
          "[&_table]:w-full [&_table]:text-sm",
          "[&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase",
          "[&_td]:border-b [&_td]:border-border/60 [&_td]:py-2.5 [&_td]:pe-4 [&_td]:align-top",
        ].join(" ")}
      >
        {children}
      </div>
    </article>
  );
}

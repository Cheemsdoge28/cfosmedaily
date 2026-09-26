import { FilterBar } from "@/components/dashboard/filter-bar";
import { EmptyState, PageHeading, Stack } from "@/components/ui/primitives";
import { pluralTasks } from "@/lib/tasks/format";
import type { ResolvedFilters, TaskTotals } from "@/lib/tasks/types";

/**
 * Shared frame for both views: the page heading, the slicers, and the vertical
 * rhythm the content sits in. Because each page renders through this, neither can
 * invent its own spacing or describe the filters differently.
 */
export function ModuleFrame({
  title,
  description,
  filters,
  totals,
  scopeLabel,
  action,
  children,
}: {
  title: string;
  description: string;
  filters: ResolvedFilters;
  totals: TaskTotals;
  /** Whose register this is — the client's name, or the whole practice. */
  scopeLabel: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const client = filters.clientId
    ? filters.clients.find((option) => option.value === filters.clientId)?.label
    : null;

  // The meta line answers "what am I looking at" without the reader having to
  // read five dropdowns back to themselves.
  const meta = [
    client ?? scopeLabel,
    pluralTasks(totals.total),
    filters.activeCount > 0
      ? `${filters.activeCount} filter${filters.activeCount === 1 ? "" : "s"} applied`
      : "unfiltered",
  ].join(" · ");

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title={title}
        description={description}
        meta={meta}
        action={action}
      />

      <FilterBar filters={filters} />

      <Stack>{children}</Stack>
    </div>
  );
}

/**
 * Shown when the register is empty rather than merely filtered to nothing.
 *
 * The distinction matters: a reader who has filtered their way to an empty table
 * needs to know to widen it, whereas a fresh install needs to be told where tasks
 * come from at all.
 */
export function NoTasksNotice({ canImport }: { canImport: boolean }) {
  return (
    <EmptyState
      message={
        canImport
          ? "The register is empty. Import CFOSME_Task_Tracker.xlsx from Administration → Workbook import, and the dashboard fills in from it."
          : "No tasks have been loaded for your account yet. CFOSME imports the task register from its workbook; this dashboard fills in as soon as they do."
      }
    />
  );
}

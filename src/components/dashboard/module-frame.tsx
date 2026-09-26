import { FilterBar } from "@/components/dashboard/filter-bar";
import { EmptyState, PageHeading, Stack } from "@/components/ui/primitives";
import type { ResolvedFilters } from "@/lib/finance/types";

/**
 * Shared frame for every module: the page heading, the filters, and the
 * vertical rhythm the content sits in. Because each module renders through
 * this, no page can invent its own spacing.
 */
export function ModuleFrame({
  title,
  description,
  filters,
  children,
}: {
  title: string;
  description: string;
  filters: ResolvedFilters;
  children: React.ReactNode;
}) {
  const unitName =
    filters.businessUnits.find((u) => u.id === filters.businessUnitId)?.name ??
    "All Units";

  const periodLabel =
    filters.viewMode === "ytd"
      ? `YTD through ${filters.month.label}`
      : filters.month.label;

  return (
    <div className="mx-auto w-full max-w-[96rem]">
      <PageHeading
        title={title}
        description={description}
        meta={`${periodLabel} · ${unitName} · ${filters.fiscalYear.label}`}
      />

      <FilterBar filters={filters} />

      <Stack>{children}</Stack>
    </div>
  );
}

export function NoDataNotice() {
  return (
    <EmptyState message="No figures have been loaded yet. This dashboard fills in as soon as the first month is imported from the accounting system." />
  );
}

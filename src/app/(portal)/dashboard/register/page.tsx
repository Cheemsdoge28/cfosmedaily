import type { Metadata } from "next";

import { RegisterTable } from "@/app/(portal)/dashboard/register/register-table";
import { ModuleFrame, NoTasksNotice } from "@/components/dashboard/module-frame";
import { ButtonLink } from "@/components/ui/button";
import { Callout, Card } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { pluralTasks } from "@/lib/tasks/format";
import { loadRegister, type TaskSearchParams } from "@/lib/tasks/queries";
import { editableClientIds, scopeLabel } from "@/lib/tasks/scope";

export const metadata: Metadata = { title: "Task Register" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: TaskSearchParams;
}) {
  const { scope, filters, tasks, totals, empty } = await loadRegister(searchParams);

  if (empty) return <NoTasksNotice canImport={scope.isPractice} />;

  // Which clients this reader may edit. Null means all of them. Per client
  // rather than per account, because a member can hold EDIT on one and VIEW on
  // another. The server checks again on every write — see lib/tasks/actions.ts.
  const editable = editableClientIds(scope);
  const canEditAny = editable === null || editable.size > 0;

  // The export carries the current view, so what downloads is what is on screen.
  const exportQuery = new URLSearchParams();
  if (filters.clientId) exportQuery.set("client", filters.clientId);
  if (filters.owner) exportQuery.set("owner", filters.owner);
  if (filters.process) exportQuery.set("process", filters.process);
  if (filters.status) exportQuery.set("status", filters.status);
  if (filters.frequency) exportQuery.set("freq", filters.frequency);

  return (
    <ModuleFrame
      title="Task Register"
      description="Full task-level control centre. Status and progress are editable here."
      filters={filters}
      totals={totals}
      scopeLabel={scopeLabel(scope)}
      action={
        <ButtonLink
          variant="outline"
          size="lg"
          render={
            <a
              href={`/api/tasks/export?${exportQuery.toString()}`}
              // The route sets a filename; `download` also stops a browser
              // trying to preview the workbook in a tab.
              download
            />
          }
        >
          <Icons.download className="size-4" />
          <span className="hidden sm:inline">Download workbook</span>
        </ButtonLink>
      }
    >
      {scope.isPractice && (
        <Callout tone="neutral">
          <b>The workbook remains the source of truth.</b> Import the latest
          CFOSME_Task_Tracker.xlsx whenever it changes, and the dashboard
          recalculates every slicer, figure and chart from it. Edits made here are
          recorded against your name and come back out in the download.
        </Callout>
      )}

      <Card
        title="All tasks"
        description={
          canEditAny
            ? "Sorted with overdue work first, then by due date"
            : "Sorted with overdue work first, then by due date · read-only for your account"
        }
        action={
          <span className="text-xs text-muted-foreground">
            {pluralTasks(tasks.length)}
          </span>
        }
        flush
      >
        <RegisterTable
          tasks={sortForRegister(tasks)}
          editableClientIds={editable ? [...editable] : null}
          // One visible client means every row names the same company, so the
          // column would be the same word ninety times over.
          showClient={filters.clients.length !== 1}
        />
      </Card>
    </ModuleFrame>
  );
}

/**
 * Overdue first, then soonest due.
 *
 * The register is a worklist, so it opens on what is late. Tasks with no readable
 * due date sort last within their group — they cannot be chased on a date, and at
 * the top they would push the urgent ones off the first screen.
 */
function sortForRegister<T extends { isOverdue: boolean; daysUntilDue: number | null }>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.daysUntilDue === null) return b.daysUntilDue === null ? 0 : 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });
}

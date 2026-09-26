import type { Metadata } from "next";
import Link from "next/link";

import { ProcessChart } from "@/components/charts/process-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { WorkloadChart } from "@/components/charts/workload-chart";
import { CompletionBars } from "@/components/dashboard/completion-bars";
import { DueWatch } from "@/components/dashboard/due-watch";
import { KpiRow } from "@/components/dashboard/kpi-card";
import { ModuleFrame, NoTasksNotice } from "@/components/dashboard/module-frame";
import { ButtonLink } from "@/components/ui/button";
import { Card, Row } from "@/components/ui/primitives";
import { Icons } from "@/components/ui/icons";
import { formatPercent, pluralTasks } from "@/lib/tasks/format";
import { loadRegister, upcoming, type TaskSearchParams } from "@/lib/tasks/queries";
import { scopeLabel } from "@/lib/tasks/scope";

export const metadata: Metadata = { title: "Executive Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: TaskSearchParams;
}) {
  const { scope, filters, tasks, totals, byClient, byOwner, byProcess, statusMix, empty } =
    await loadRegister(searchParams);

  if (empty) return <NoTasksNotice canImport={scope.isPractice} />;

  return (
    <ModuleFrame
      title="Executive Dashboard"
      description="Live view of client delivery, workload, deadlines and completion."
      filters={filters}
      totals={totals}
      scopeLabel={scopeLabel(scope)}
      action={
        <ButtonLink
          variant="outline"
          size="lg"
          render={<Link href="/dashboard/register" />}
        >
          <Icons.list className="size-4" />
          <span className="hidden sm:inline">Task register</span>
        </ButtonLink>
      }
    >
      <KpiRow
        items={[
          {
            label: "Completion",
            value: formatPercent(totals.completion),
            caption: "Average progress across the tasks in view",
            icon: "target",
            // The tone reports where the month stands rather than decorating the
            // tile: nothing is "positive" about 40% on the 25th.
            captionTone:
              totals.completion >= 90
                ? "positive"
                : totals.completion < 50
                  ? "negative"
                  : "neutral",
          },
          {
            label: "Tasks in view",
            value: String(totals.total),
            caption:
              filters.activeCount > 0
                ? `Filtered from ${pluralTasks(totals.total)} — reset to see all`
                : "The whole register",
            icon: "list",
          },
          {
            label: "Completed",
            value: String(totals.done),
            caption: `${formatPercent(totals.donePct)} of the tasks in view`,
            icon: "check",
            captionTone: totals.donePct >= 90 ? "positive" : "neutral",
          },
          {
            label: "Needs attention",
            value: String(totals.attention),
            caption: "In progress, at risk or blocked",
            icon: "alert",
            captionTone: totals.attention > 0 ? "negative" : "neutral",
          },
          {
            label: "Overdue",
            value: String(totals.overdue),
            caption:
              totals.undated > 0
                ? `Open and past due · ${totals.undated} more have no readable date`
                : "Open tasks past their due date",
            icon: "overdue",
            captionTone: totals.overdue > 0 ? "negative" : "positive",
          },
        ]}
      />

      <Row className="lg:grid-cols-[1.35fr_1fr]">
        <Card
          title="Completion by client"
          description="Weakest first — the client needing attention is always at the top"
        >
          <CompletionBars data={byClient} />
        </Card>

        <Card title="Status mix" description="Where the register stands today">
          <StatusDonut data={statusMix} />
        </Card>
      </Row>

      <Row className="lg:grid-cols-3">
        <Card title="Workload by owner" description="Task volume, split by what is done">
          <WorkloadChart data={byOwner} />
        </Card>

        <Card title="Process mix" description="Where the team's time is concentrated">
          <ProcessChart data={byProcess} />
        </Card>

        <Card title="Due date watch" description="Open tasks by urgency">
          <DueWatch totals={totals} tasks={upcoming(tasks)} />
        </Card>
      </Row>
    </ModuleFrame>
  );
}

import Link from "next/link";

import { Badge } from "@/components/ui/primitives";
import { formatDate, formatDueDistance } from "@/lib/tasks/format";
import type { TaskRow, TaskTotals } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

/**
 * What is coming, and what has already gone past.
 *
 * Three counts and then the actual tasks, because a reader who sees "6 overdue"
 * immediately wants to know which six. Each row links into the register filtered
 * to that client, so the card is a way in rather than a dead end.
 *
 * The third count is the honest one: tasks whose due date could not be read from
 * the workbook. The dashboard this replaces had 59 of 88 rows in that state and
 * showed the number without comment. Almost all of them now resolve, so a figure
 * above zero here means a genuinely unreadable cell — which is a workbook to fix,
 * and the line says so.
 */
export function DueWatch({
  totals,
  tasks,
}: {
  totals: TaskTotals;
  tasks: TaskRow[];
}) {
  return (
    <div className="space-y-4">
      <dl className="space-y-1.5">
        <StatLine label="Overdue" value={totals.overdue} tone={totals.overdue > 0 ? "bad" : "good"} />
        <StatLine
          label="Due in the next 7 days"
          value={totals.dueWithinWeek}
          tone={totals.dueWithinWeek > 0 ? "warn" : "neutral"}
        />
        <StatLine label="No recognised due date" value={totals.undated} tone="neutral" />
      </dl>

      {totals.undated > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {totals.undated === 1 ? "One open task has" : `${totals.undated} open tasks have`}{" "}
          a due date the importer could not read — they are excluded from the
          overdue count. Correct the Due Date cell in the workbook and import again.
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          Nothing open. Every task in this view is done.
        </p>
      ) : (
        <ul className="border-t border-border">
          {tasks.map((task) => (
            <li key={task.id} className="border-b border-border/60 last:border-b-0">
              <Link
                href={`/dashboard/register?client=${encodeURIComponent(task.clientId)}`}
                className={cn(
                  "-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-2",
                  "transition-colors hover:bg-muted",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-heading">
                    {task.clientName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {task.activity || task.process}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      task.isOverdue ? "text-[var(--negative)]" : "text-muted-foreground",
                    )}
                  >
                    {formatDueDistance(task.daysUntilDue)}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {task.dueDate ? formatDate(task.dueDate) : (task.dueText ?? "—")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-foreground">{label}</dt>
      <dd>
        {/* A count of nothing is good news and reads better plain than as a pill. */}
        {value === 0 ? (
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">0</span>
        ) : (
          <Badge tone={tone}>{value}</Badge>
        )}
      </dd>
    </div>
  );
}

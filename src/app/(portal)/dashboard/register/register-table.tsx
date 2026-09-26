"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";

import {
  Badge,
  TBody,
  THead,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { setTaskProgress, setTaskStatus } from "@/lib/tasks/actions";
import {
  formatDate,
  formatDueDistance,
  frequencyLabel,
  statusLabel,
  statusTone,
} from "@/lib/tasks/format";
import { STATUS_ORDER, type TaskRow } from "@/lib/tasks/types";
import type { TaskStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * The register.
 *
 * Status and progress are editable in place, as they have always been, but the
 * edits now persist and are attributed. Three things that took care:
 *
 *   optimism    a status change has to paint immediately — a dropdown that waits
 *               for a round trip feels broken — but the server owns the coupling
 *               rules, so it can come back with a different answer than the one
 *               the row guessed (picking "At risk" on a task at 100% also drops
 *               its progress). The row therefore shows its guess, then takes the
 *               server's result as the truth.
 *
 *   failure     a rejected edit must visibly revert rather than leave the row
 *               showing a state the database does not hold. The message appears on
 *               the row itself, because a toast at the edge of a 90-row table is
 *               nowhere near the row that failed.
 *
 *   read-only   the controls are disabled on rows whose client this reader holds
 *               no EDIT grant for — which can be some rows and not others — and
 *               the server checks again on every write. The disabled attribute is
 *               a courtesy, not the gate.
 */

type Editable = { status: TaskStatus; progress: number };

export function RegisterTable({
  tasks,
  editableClientIds,
  showClient,
}: {
  tasks: TaskRow[];
  /**
   * The clients this reader may edit, or null for all of them. Per client, not
   * per account: the same person can hold EDIT on one and VIEW on another, so
   * two rows of this table can legitimately differ.
   */
  editableClientIds: string[] | null;
  /** Hidden when every row is the same company. */
  showClient: boolean;
}) {
  const editable = editableClientIds ? new Set(editableClientIds) : null;
  if (tasks.length === 0) {
    return (
      <div className="px-5 py-14 text-center text-sm text-muted-foreground">
        No tasks match the selected slicers. Reset them above to see the whole
        register.
      </div>
    );
  }

  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr>
            {showClient && <Th>Client</Th>}
            <Th grow>Process / activity</Th>
            <Th>Owner</Th>
            <Th>Frequency</Th>
            <Th>Due</Th>
            <Th>Status</Th>
            <Th align="right">Progress</Th>
          </Tr>
        </THead>
        <TBody>
          {tasks.map((task) => (
            <TaskRowCells
              key={task.id}
              task={task}
              canEdit={editable === null || editable.has(task.clientId)}
              showClient={showClient}
            />
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}

function TaskRowCells({
  task,
  canEdit,
  showClient,
}: {
  task: TaskRow;
  canEdit: boolean;
  showClient: boolean;
}) {
  const server: Editable = { status: task.status, progress: task.progress };

  const [committed, setCommitted] = useState<Editable>(server);
  const [optimistic, setOptimistic] = useOptimistic(
    committed,
    (_current, next: Editable) => next,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(guess: Editable, call: () => Promise<
    { ok: true; status: TaskStatus; progress: number } | { ok: false; error: string }
  >) {
    setError(null);
    startTransition(async () => {
      setOptimistic(guess);
      const result = await call();
      if (result.ok) {
        // The server's answer, not the guess — it applied the coupling rules.
        setCommitted({ status: result.status, progress: result.progress });
      } else {
        // useOptimistic unwinds to `committed` when the transition ends, so the
        // row returns to the last state the database confirmed on its own.
        setError(result.error);
      }
    });
  }

  const overdue = task.isOverdue && optimistic.status !== "DONE";

  return (
    <Tr className={cn(isPending && "opacity-70 transition-opacity")}>
      {showClient && (
        <Td>
          <span className="font-semibold text-heading">{task.clientName}</span>
          <br />
          <span className="text-xs text-muted-foreground">{task.reference}</span>
        </Td>
      )}

      <Td>
        <span className="font-medium text-foreground">
          {task.activity || task.process}
        </span>
        <br />
        <span className="text-xs text-muted-foreground">
          {task.process}
          {task.description ? ` · ${task.description}` : ""}
        </span>
        {error && (
          // role="alert" so the failure is announced, not just coloured.
          <span role="alert" className="mt-1 block text-xs text-tone-bad">
            {error}
          </span>
        )}
      </Td>

      <Td>{task.owner || "Unassigned"}</Td>
      <Td className="whitespace-nowrap">{frequencyLabel(task.frequency)}</Td>

      <Td>
        <span
          className={cn(
            "font-medium whitespace-nowrap",
            overdue ? "text-[var(--negative)]" : "text-foreground",
          )}
        >
          {task.dueDate ? formatDate(task.dueDate) : (task.dueText ?? "—")}
        </span>
        <br />
        <span className="text-xs text-muted-foreground">
          {/* The rule is the useful subtitle when the date resolved; when it did
              not, saying so matters more than repeating the cadence. */}
          {task.dueDate
            ? task.dueRule || formatDueDistance(task.daysUntilDue)
            : "No recognised date"}
        </span>
      </Td>

      <Td>
        {canEdit ? (
          <StatusPicker
            value={optimistic.status}
            disabled={isPending}
            onChange={(status) =>
              run({ ...optimistic, status }, () => setTaskStatus(task.id, status))
            }
          />
        ) : (
          <Badge tone={statusTone(optimistic.status)}>
            {statusLabel(optimistic.status)}
          </Badge>
        )}
      </Td>

      <Td align="right">
        <ProgressEditor
          value={optimistic.progress}
          canEdit={canEdit}
          disabled={isPending}
          onCommit={(progress) =>
            run({ ...optimistic, progress }, () => setTaskProgress(task.id, progress))
          }
        />
      </Td>
    </Tr>
  );
}

/**
 * The status editor.
 *
 * A native `<select>` rather than the portal's Base UI one, and deliberately: the
 * register renders one of these per row and the whole register is on one page, so
 * a hundred menu components would be a hundred popovers' worth of listeners and
 * markup for a control that is used once or twice a session. A native select also
 * gets the platform picker on a phone, which is the better control on the device
 * the register is most often checked from.
 *
 * It is styled to the portal's control height and colours so it does not read as
 * an unstyled browser widget, and it carries the status tone as a left border —
 * the only place colour appears, since the label says the state anyway.
 */
function StatusPicker({
  value,
  disabled,
  onChange,
}: {
  value: TaskStatus;
  disabled: boolean;
  onChange: (status: TaskStatus) => void;
}) {
  const tone = statusTone(value);

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="Task status"
      onChange={(event) => onChange(event.target.value as TaskStatus)}
      className={cn(
        "h-8 w-full min-w-[8.5rem] rounded-md border bg-card px-2 text-xs font-medium",
        "border-input text-foreground",
        "transition-[border-color,box-shadow] focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        tone === "good" && "border-l-2 border-l-[var(--positive)]",
        tone === "warn" && "border-l-2 border-l-[var(--caution)]",
        tone === "bad" && "border-l-2 border-l-[var(--negative)]",
      )}
    >
      {STATUS_ORDER.map((status) => (
        <option key={status} value={status}>
          {statusLabel(status)}
        </option>
      ))}
    </select>
  );
}

/**
 * The progress editor.
 *
 * A range input, which is what the register has always used and the right control
 * for a figure nobody needs to the percent. It commits on `change` rather than
 * `input` — one write when the thumb is released, not forty while it is dragged —
 * and shows the value it is being dragged to in the meantime.
 */
function ProgressEditor({
  value,
  canEdit,
  disabled,
  onCommit,
}: {
  value: number;
  canEdit: boolean;
  disabled: boolean;
  onCommit: (progress: number) => void;
}) {
  // While dragging, the thumb's position is the browser's to own; this is only
  // the number shown beside it.
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? value;
  const inputRef = useRef<HTMLInputElement>(null);

  if (!canEdit) {
    return (
      <div className="flex items-center justify-end gap-2">
        <div
          role="meter"
          aria-label="Progress"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-[var(--chart-1)]"
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="w-9 text-right text-xs font-semibold tabular-nums text-muted-foreground">
          {value}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        ref={inputRef}
        type="range"
        min={0}
        max={100}
        step={5}
        value={shown}
        disabled={disabled}
        aria-label="Progress"
        onChange={(event) => setDragging(Number(event.target.value))}
        // `change` on a range input fires when the drag ends (and on every arrow
        // key press), which is exactly when the write should happen.
        onBlur={() => setDragging(null)}
        onMouseUp={() => commit()}
        onKeyUp={() => commit()}
        onTouchEnd={() => commit()}
        className={cn(
          "h-1.5 w-20 cursor-pointer accent-[var(--chart-1)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      />
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-heading">
        {shown}%
      </span>
    </div>
  );

  function commit() {
    const next = Number(inputRef.current?.value ?? value);
    setDragging(null);
    if (next !== value) onCommit(next);
  }
}

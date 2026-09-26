/**
 * The one place that decides how status and progress move together.
 *
 * These two fields are not independent, and the original dashboard coupled them
 * inline in three separate event handlers — which is how a task could be saved
 * as "Done" at 60% progress. That exact row is in the workbook this replaces
 * (TS0011: Done, 60%), so the rule is not hypothetical.
 *
 * The coupling, stated once:
 *
 *   setting status to Done      -> progress becomes 100
 *   dragging progress to 100    -> status becomes Done
 *   dragging progress below 100 -> a Done task falls back to In progress;
 *                                  any other status is left alone, because a
 *                                  blocked task at 40% is still blocked
 *   leaving progress at 0       -> a Done task cannot be at 0; it is Not started
 *
 * Both the register's editors and the workbook importer call this, so a figure
 * that arrives by upload obeys the same rule as one set by hand.
 */

import type { TaskStatus } from "@/generated/prisma/enums";

export type TaskState = {
  status: TaskStatus;
  progress: number;
};

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Reconciles a state that may have been given inconsistently — by an importer
 * reading a spreadsheet cell, or by a caller setting only one of the two.
 */
export function reconcile(state: TaskState): TaskState {
  const progress = clampProgress(state.progress);

  if (state.status === "DONE" && progress < 100) {
    // The workbook's own inconsistency. Trust the progress figure, because it
    // is the one someone typed a number into, and demote the status to match.
    return { status: progress === 0 ? "NOT_STARTED" : "IN_PROGRESS", progress };
  }

  if (progress === 100 && state.status !== "DONE") {
    return { status: "DONE", progress };
  }

  return { status: state.status, progress };
}

/** The result of someone choosing a status in the register. */
export function applyStatus(current: TaskState, status: TaskStatus): TaskState {
  if (status === "DONE") return { status, progress: 100 };

  // Coming off Done, 100% would immediately snap it back. Anything else keeps
  // the progress the task had, because changing Blocked to At risk says nothing
  // about how far along the work is.
  const progress = current.status === "DONE" && current.progress === 100 ? 0 : current.progress;
  return reconcile({ status, progress });
}

/** The result of someone dragging the progress slider. */
export function applyProgress(current: TaskState, progress: number): TaskState {
  const next = clampProgress(progress);

  if (next === 100) return { status: "DONE", progress: 100 };
  if (current.status === "DONE") {
    return { status: next === 0 ? "NOT_STARTED" : "IN_PROGRESS", progress: next };
  }
  return { status: current.status, progress: next };
}

/** True when the two states differ in either field — used to skip no-op writes. */
export function differs(a: TaskState, b: TaskState): boolean {
  return a.status !== b.status || a.progress !== b.progress;
}

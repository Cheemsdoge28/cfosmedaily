/**
 * Shared task types. Kept free of `server-only` so client components can
 * consume the derived shapes the server passes down.
 */

import type { Frequency, TaskStatus } from "@/generated/prisma/enums";

/** The pseudo-value every slicer uses for "no filter on this dimension". */
export const ALL = "all";

/**
 * The five states, in the order they are always presented: the pipeline runs
 * left to right, and the two that need attention sit together in the middle.
 *
 * This order is the single source of truth for it — the donut's slices, the
 * legend, the status filter and the register's dropdown all read from here, so
 * they cannot drift apart.
 */
export const STATUS_ORDER: TaskStatus[] = [
  "DONE",
  "IN_PROGRESS",
  "AT_RISK",
  "BLOCKED",
  "NOT_STARTED",
];

/** Frequencies in cadence order, shortest cycle first. */
export const FREQUENCY_ORDER: Frequency[] = [
  "DAILY",
  "WEEKLY",
  "FORTNIGHTLY",
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "AD_HOC",
];

/**
 * The statuses that mean "someone still has to do something about this".
 *
 * Not simply "everything that is not DONE": NOT_STARTED is the normal resting
 * state of a monthly task on the 1st of the month and needs no attention at
 * all, whereas a blocked one does. The Attention KPI counts these three.
 */
export const ATTENTION_STATUSES: TaskStatus[] = [
  "IN_PROGRESS",
  "AT_RISK",
  "BLOCKED",
];

/** A task as every screen consumes it — dates already reduced to ISO strings. */
export type TaskRow = {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  process: string;
  activity: string;
  description: string;
  owner: string;
  frequency: Frequency;
  dueRule: string;
  /** ISO date, or null when the workbook's wording could not be resolved. */
  dueDate: string | null;
  /** The workbook's raw wording, when it was not a date. */
  dueText: string | null;
  status: TaskStatus;
  progress: number;
  notes: string;
  /** True when open and the due date has passed. */
  isOverdue: boolean;
  /** Whole days until due; negative when past. Null without a resolved date. */
  daysUntilDue: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
};

/** One slicer's options, resolved against what the visible tasks contain. */
export type FilterOption = {
  value: string;
  label: string;
  /** How many of the currently visible tasks carry this value. */
  count: number;
};

/** The state of the five slicers, resolved against what exists. */
export type ResolvedFilters = {
  clientId: string;
  owner: string;
  process: string;
  status: string;
  frequency: string;
  clients: FilterOption[];
  owners: FilterOption[];
  processes: FilterOption[];
  statuses: FilterOption[];
  frequencies: FilterOption[];
  /** True when the signed-in user is pinned to one client and cannot change it. */
  clientLocked: boolean;
  /** How many slicers are currently narrowing the view. */
  activeCount: number;
};

/** The headline figures. Every one of these is derived, never stored. */
export type TaskTotals = {
  total: number;
  /** Mean progress across the filtered tasks, 0-100. */
  completion: number;
  done: number;
  donePct: number;
  attention: number;
  overdue: number;
  dueWithinWeek: number;
  /** Open tasks whose due date could not be resolved from the workbook. */
  undated: number;
};

/** A client or owner rollup — the bars and the workload chart. */
export type GroupRollup = {
  key: string;
  label: string;
  total: number;
  done: number;
  open: number;
  overdue: number;
  /** Mean progress across the group, 0-100. */
  completion: number;
};

/** One slice of the status mix. */
export type StatusSlice = {
  status: TaskStatus;
  label: string;
  count: number;
};

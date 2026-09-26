/**
 * Display formatting and labels.
 *
 * The database stores the register's dimensions as enums so the dashboard can
 * group by them safely; nobody reading a screen should ever see `NOT_STARTED`.
 * Every enum-to-English mapping lives here, in one direction only, so the
 * register's dropdown and the dashboard's legend cannot disagree about what a
 * state is called.
 */

import type { Frequency, TaskStatus } from "@/generated/prisma/enums";
import type { BadgeTone } from "@/components/ui/primitives";

const STATUS_LABELS: Record<TaskStatus, string> = {
  DONE: "Done",
  IN_PROGRESS: "In progress",
  AT_RISK: "At risk",
  BLOCKED: "Blocked",
  NOT_STARTED: "Not started",
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  ANNUAL: "Annual",
  AD_HOC: "Ad hoc",
};

export function statusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status];
}

export function frequencyLabel(frequency: Frequency): string {
  return FREQUENCY_LABELS[frequency];
}

/**
 * The pill tone for a state.
 *
 * `NOT_STARTED` is deliberately neutral rather than a warning: on the first of
 * the month every monthly task is not started, and a register of eighty amber
 * pills says nothing. Amber is reserved for the states that mean a deadline is
 * genuinely at risk.
 */
const STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  DONE: "good",
  IN_PROGRESS: "neutral",
  AT_RISK: "warn",
  BLOCKED: "bad",
  NOT_STARTED: "neutral",
};

export function statusTone(status: TaskStatus): BadgeTone {
  return STATUS_TONES[status];
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/** "08 Sep 2026", or an em dash when there is no date. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value: Date | string | null): string {
  if (!value) return "Never";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * How a due date reads to someone scanning the register: "Today", "In 3 days",
 * "6 days overdue". A bare date makes the reader do the arithmetic, and the one
 * thing they want to know is whether it has passed.
 */
export function formatDueDistance(days: number | null): string {
  if (days === null) return "No recognised date";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `In ${days} days`;
}

/** A count with its noun agreeing — "1 task", "14 tasks". */
export function pluralTasks(count: number): string {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

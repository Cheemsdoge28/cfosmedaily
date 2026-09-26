import "server-only";

import { prisma } from "@/lib/db";
import { daysUntil } from "@/lib/tasks/due-date";
import { frequencyLabel, statusLabel } from "@/lib/tasks/format";
import { requireTaskScope, taskScopeFilter, type TaskScope } from "@/lib/tasks/scope";
import {
  ALL,
  ATTENTION_STATUSES,
  FREQUENCY_ORDER,
  STATUS_ORDER,
  type FilterOption,
  type GroupRollup,
  type ResolvedFilters,
  type StatusSlice,
  type TaskRow,
  type TaskTotals,
} from "@/lib/tasks/types";
import type { Frequency, TaskStatus } from "@/generated/prisma/enums";

/**
 * The register, and everything the dashboard derives from it.
 *
 * One query per request, then every figure computed from that one array. The
 * dashboard's KPIs, its four charts and the register table are therefore always
 * describing the same set of tasks — the dashboard this replaces recomputed each
 * card from its own filtered copy, which is a standing invitation for the
 * Overdue tile and the Due Date Watch card to disagree.
 *
 * Loading the whole scoped register into memory is the right call at this size:
 * a practice runs a few hundred recurring tasks, the rows are small, and the
 * cross-filtered slicer counts below need the full set anyway. Past roughly ten
 * thousand tasks this should become a set of `groupBy` aggregates with the table
 * paginated; nothing above this function would have to change.
 */

/** The search params the module pages accept. */
export type TaskSearchParams = Promise<{
  client?: string;
  owner?: string;
  process?: string;
  status?: string;
  freq?: string;
}>;

export type RegisterData = {
  scope: TaskScope;
  filters: ResolvedFilters;
  /** Every task in scope, before the slicers. */
  all: TaskRow[];
  /** What the slicers leave. Everything on screen is derived from this. */
  tasks: TaskRow[];
  totals: TaskTotals;
  byClient: GroupRollup[];
  byOwner: GroupRollup[];
  byProcess: GroupRollup[];
  statusMix: StatusSlice[];
  /** True when the register has no tasks at all — a fresh install. */
  empty: boolean;
};

function normalise(value: string | undefined | null): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text === ALL ? "" : text;
}

/** The five dimensions a task can be sliced by. */
type Dimension = "clientId" | "owner" | "process" | "status" | "frequency";

const DIMENSIONS: Dimension[] = ["clientId", "owner", "process", "status", "frequency"];

function matches(task: TaskRow, dimension: Dimension, value: string): boolean {
  if (!value) return true;
  switch (dimension) {
    case "clientId":
      return task.clientId === value;
    case "owner":
      return task.owner === value;
    case "process":
      return task.process === value;
    case "status":
      return task.status === value;
    case "frequency":
      return task.frequency === value;
  }
}

/**
 * Applies every selection except one.
 *
 * This is what makes the slicer counts useful rather than decorative: the count
 * beside "Rupali Sharma" is how many tasks selecting her would actually leave
 * given the client and status already chosen, not how many exist in total. A
 * count that ignores the other slicers sends a reader to an empty table.
 */
function filterExcept(
  tasks: TaskRow[],
  selections: Record<Dimension, string>,
  except: Dimension | null,
): TaskRow[] {
  return tasks.filter((task) =>
    DIMENSIONS.every(
      (dimension) =>
        dimension === except || matches(task, dimension, selections[dimension]),
    ),
  );
}

function countBy<T extends string>(
  tasks: TaskRow[],
  pick: (task: TaskRow) => T,
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const task of tasks) {
    const key = pick(task);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export async function loadRegister(
  searchParams: TaskSearchParams,
): Promise<RegisterData> {
  const scope = await requireTaskScope();
  const params = await searchParams;

  const requestedClient = normalise(params.client);

  const rows = await prisma.task.findMany({
    where: taskScopeFilter(scope, requestedClient),
    include: {
      client: { select: { id: true, name: true } },
      updatedBy: { select: { name: true } },
    },
    orderBy: [{ client: { name: "asc" } }, { reference: "asc" }],
  });

  const today = new Date();

  const all: TaskRow[] = rows.map((row) => {
    const dueDate = row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null;
    const days = daysUntil(row.dueDate, today);

    return {
      id: row.id,
      reference: row.reference,
      clientId: row.clientId,
      clientName: row.client.name,
      process: row.process,
      activity: row.activity,
      description: row.description,
      owner: row.owner,
      frequency: row.frequency,
      dueRule: row.dueRule,
      dueDate,
      dueText: row.dueText,
      status: row.status,
      progress: row.progress,
      notes: row.notes,
      // An overdue task is an *open* one past its date. A task finished late is
      // not overdue, it is done, and colouring it red would bury the ones that
      // still need chasing.
      isOverdue: row.status !== "DONE" && days !== null && days < 0,
      daysUntilDue: days,
      updatedByName: row.updatedBy?.name ?? null,
      updatedAt: row.statusChangedAt?.toISOString() ?? null,
    };
  });

  // A requested client that the reader holds no grant to was already ignored by
  // `taskScopeFilter`, so the slicer must not show it as selected either.
  const permittedClient =
    scope.visibleClientIds === null || scope.visibleClientIds.includes(requestedClient)
      ? requestedClient
      : "";

  const selections: Record<Dimension, string> = {
    clientId: permittedClient,
    owner: normalise(params.owner),
    process: normalise(params.process),
    status: normalise(params.status),
    frequency: normalise(params.freq),
  };

  // A selection naming something the register does not contain — a stale
  // bookmark, a client whose last task was deleted — is dropped rather than
  // silently producing an empty table.
  if (selections.owner && !all.some((t) => t.owner === selections.owner)) {
    selections.owner = "";
  }
  if (selections.process && !all.some((t) => t.process === selections.process)) {
    selections.process = "";
  }

  const tasks = filterExcept(all, selections, null);

  const filters: ResolvedFilters = {
    clientId: selections.clientId,
    owner: selections.owner,
    process: selections.process,
    status: selections.status,
    frequency: selections.frequency,
    clients: clientOptions(all, selections),
    owners: textOptions(all, selections, "owner", (t) => t.owner),
    processes: textOptions(all, selections, "process", (t) => t.process),
    statuses: statusOptions(all, selections),
    frequencies: frequencyOptions(all, selections),
    // Locked when there is nothing to choose between: exactly one client is
    // visible, so a dropdown offering only that is furniture.
    clientLocked: scope.visibleClientIds?.length === 1,
    activeCount: DIMENSIONS.filter((d) => selections[d]).length,
  };

  return {
    scope,
    filters,
    all,
    tasks,
    totals: deriveTotals(tasks),
    byClient: rollup(tasks, (t) => [t.clientId, t.clientName]),
    byOwner: rollup(tasks, (t) => [t.owner, t.owner || "Unassigned"]),
    byProcess: rollup(tasks, (t) => [t.process, t.process]),
    statusMix: deriveStatusMix(tasks),
    empty: all.length === 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Slicer options
// ─────────────────────────────────────────────────────────────────────────────

function clientOptions(
  all: TaskRow[],
  selections: Record<Dimension, string>,
): FilterOption[] {
  const pool = filterExcept(all, selections, "clientId");
  const counts = countBy(pool, (t) => t.clientId);
  const names = new Map(all.map((t) => [t.clientId, t.clientName]));

  return [...names.entries()]
    .map(([id, name]) => ({
      value: id,
      label: name,
      count: counts.get(id) ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function textOptions(
  all: TaskRow[],
  selections: Record<Dimension, string>,
  dimension: Dimension,
  pick: (task: TaskRow) => string,
): FilterOption[] {
  const pool = filterExcept(all, selections, dimension);
  const counts = countBy(pool, pick);
  const values = [...new Set(all.map(pick).filter(Boolean))];

  return values
    .map((value) => ({ value, label: value, count: counts.get(value) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Statuses are listed in the register's fixed order and always in full, even at
 * zero — "Blocked 0" is a fact worth reading, and a list whose entries come and
 * go as you filter is one you cannot learn the shape of.
 */
function statusOptions(
  all: TaskRow[],
  selections: Record<Dimension, string>,
): FilterOption[] {
  const counts = countBy(filterExcept(all, selections, "status"), (t) => t.status);
  return STATUS_ORDER.map((status) => ({
    value: status,
    label: statusLabel(status),
    count: counts.get(status) ?? 0,
  }));
}

/** Frequencies in cadence order, but only those the register actually uses. */
function frequencyOptions(
  all: TaskRow[],
  selections: Record<Dimension, string>,
): FilterOption[] {
  const present = new Set(all.map((t) => t.frequency));
  const counts = countBy(
    filterExcept(all, selections, "frequency"),
    (t) => t.frequency,
  );

  return FREQUENCY_ORDER.filter((frequency) => present.has(frequency)).map(
    (frequency) => ({
      value: frequency,
      label: frequencyLabel(frequency),
      count: counts.get(frequency) ?? 0,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivation
// ─────────────────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function deriveTotals(tasks: TaskRow[]): TaskTotals {
  const done = tasks.filter((t) => t.status === "DONE").length;
  const open = tasks.filter((t) => t.status !== "DONE");

  return {
    total: tasks.length,
    completion: mean(tasks.map((t) => t.progress)),
    done,
    donePct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    attention: tasks.filter((t) => ATTENTION_STATUSES.includes(t.status)).length,
    overdue: tasks.filter((t) => t.isOverdue).length,
    dueWithinWeek: open.filter(
      (t) => t.daysUntilDue !== null && t.daysUntilDue >= 0 && t.daysUntilDue <= 7,
    ).length,
    undated: open.filter((t) => t.daysUntilDue === null).length,
  };
}

/**
 * Groups tasks and derives each group's standing.
 *
 * Completion is the mean of the members' progress, which is what the bars have
 * always shown. It is deliberately not "done / total": a client with four tasks
 * all at 90% is nearly finished, and a percentage that reports 0% for them is
 * not describing anything a reader recognises.
 */
function rollup(
  tasks: TaskRow[],
  key: (task: TaskRow) => [string, string],
): GroupRollup[] {
  const groups = new Map<string, { label: string; members: TaskRow[] }>();

  for (const task of tasks) {
    const [id, label] = key(task);
    const group = groups.get(id);
    if (group) group.members.push(task);
    else groups.set(id, { label, members: [task] });
  }

  return [...groups.entries()]
    .map(([id, { label, members }]) => ({
      key: id,
      label,
      total: members.length,
      done: members.filter((t) => t.status === "DONE").length,
      open: members.filter((t) => t.status !== "DONE").length,
      overdue: members.filter((t) => t.isOverdue).length,
      completion: mean(members.map((t) => t.progress)),
    }))
    // Weakest first: the list exists to surface who needs help, so the client
    // furthest behind is the one a reader should not have to scroll for.
    .sort((a, b) => a.completion - b.completion || b.total - a.total);
}

function deriveStatusMix(tasks: TaskRow[]): StatusSlice[] {
  const counts = countBy(tasks, (t) => t.status);
  return STATUS_ORDER.map((status) => ({
    status,
    label: statusLabel(status),
    count: counts.get(status) ?? 0,
  }));
}

/** The soonest open deadlines — what the Due Date Watch card lists. */
export function upcoming(tasks: TaskRow[], limit = 8): TaskRow[] {
  return tasks
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => {
      // Undated tasks sort last: they cannot be chased on a date, and putting
      // them at the top would push the genuinely urgent ones off the card.
      if (a.daysUntilDue === null) return b.daysUntilDue === null ? 0 : 1;
      if (b.daysUntilDue === null) return -1;
      return a.daysUntilDue - b.daysUntilDue;
    })
    .slice(0, limit);
}

/** Every client with its task count, for the admin screens. */
export async function listClients() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      // `access` rather than `users`: people reach a client through a grant now,
      // so this counts the people who can see it.
      _count: { select: { access: true, tasks: true } },
    },
  });
}

export type { Frequency, TaskStatus };

"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { canEditClient, requireTaskScope } from "@/lib/tasks/scope";
import { statusLabel } from "@/lib/tasks/format";
import { applyProgress, applyStatus, differs } from "@/lib/tasks/transition";
import type { TaskStatus } from "@/generated/prisma/enums";
import { STATUS_ORDER } from "@/lib/tasks/types";

/**
 * Editing the register.
 *
 * Two operations, because two are all the register has ever offered: set a
 * status, drag a progress bar. Both go through the same three steps — establish
 * that this reader may touch this task, run the change through the coupling
 * rules, and write the move to the history — so neither can drift from the other.
 *
 * The dashboard this replaces mutated a JavaScript array, so an edit survived
 * exactly until the tab was closed and two people editing saw different
 * registers. These writes are durable and attributed.
 */

export type TaskMutationResult =
  | { ok: true; status: TaskStatus; progress: number }
  | { ok: false; error: string };

/**
 * May this reader move this task?
 *
 * Practice staff may move anything. Everyone else may move a task only where they
 * hold an EDIT grant for *that task's client* — so the same person can be
 * read-write on one client and read-only on another, which an account-wide role
 * could not express.
 *
 * The register renders a read-only reader's controls disabled; this is the check
 * that makes that more than a UI courtesy.
 */
type Authorised = {
  ok: true;
  scope: Awaited<ReturnType<typeof requireTaskScope>>;
  task: {
    id: string;
    clientId: string;
    reference: string;
    status: TaskStatus;
    progress: number;
  };
};

async function authorise(taskId: string): Promise<Authorised | { ok: false; error: string }> {
  const scope = await requireTaskScope();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      clientId: true,
      reference: true,
      status: true,
      progress: true,
      client: { select: { name: true, isActive: true } },
    },
  });

  if (!task) return { ok: false, error: "That task no longer exists." };

  if (!scope.isPractice) {
    const visible = scope.visibleClientIds?.includes(task.clientId) ?? false;
    if (!visible) {
      // Deliberately the same message as a missing task: a reader who may not
      // see a task should not be able to learn that it exists.
      return { ok: false, error: "That task no longer exists." };
    }
    if (!canEditClient(scope, task.clientId)) {
      return {
        ok: false,
        error: `Your access to ${task.client.name} is read-only.`,
      };
    }
  }

  if (!task.client.isActive) {
    return {
      ok: false,
      error: `${task.client.name} is suspended, so its register is read-only.`,
    };
  }

  return {
    ok: true,
    scope,
    task: {
      id: task.id,
      clientId: task.clientId,
      reference: task.reference,
      status: task.status,
      progress: task.progress,
    },
  };
}

async function commit(input: {
  taskId: string;
  reference: string;
  clientId: string;
  userId: string;
  from: { status: TaskStatus; progress: number };
  to: { status: TaskStatus; progress: number };
}): Promise<TaskMutationResult> {
  if (!differs(input.from, input.to)) {
    // Dragging a slider back to where it started, or re-picking the current
    // status. Nothing to write, and no history entry worth keeping.
    return { ok: true, ...input.to };
  }

  await prisma.$transaction([
    prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: input.to.status,
        progress: input.to.progress,
        updatedById: input.userId,
        statusChangedAt: new Date(),
      },
    }),
    prisma.taskEvent.create({
      data: {
        taskId: input.taskId,
        userId: input.userId,
        fromStatus: input.from.status,
        toStatus: input.to.status,
        fromProgress: input.from.progress,
        toProgress: input.to.progress,
        source: "MANUAL",
      },
    }),
  ]);

  await recordAudit({
    action: "task.update",
    userId: input.userId,
    clientId: input.clientId,
    detail:
      `${input.reference}: ${statusLabel(input.from.status)} ${input.from.progress}% → ` +
      `${statusLabel(input.to.status)} ${input.to.progress}%`,
  });

  // Both screens read the same register, so both are stale after a write.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/register");

  return { ok: true, ...input.to };
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<TaskMutationResult> {
  if (!STATUS_ORDER.includes(status)) {
    return { ok: false, error: "That is not a status this register uses." };
  }

  const gate = await authorise(taskId);
  if (!gate.ok) return gate;

  const from = { status: gate.task.status, progress: gate.task.progress };

  return commit({
    taskId: gate.task.id,
    reference: gate.task.reference,
    clientId: gate.task.clientId,
    userId: gate.scope.user.id,
    from,
    to: applyStatus(from, status),
  });
}

export async function setTaskProgress(
  taskId: string,
  progress: number,
): Promise<TaskMutationResult> {
  if (!Number.isFinite(progress)) {
    return { ok: false, error: "That is not a progress figure." };
  }

  const gate = await authorise(taskId);
  if (!gate.ok) return gate;

  const from = { status: gate.task.status, progress: gate.task.progress };

  return commit({
    taskId: gate.task.id,
    reference: gate.task.reference,
    clientId: gate.task.clientId,
    userId: gate.scope.user.id,
    from,
    to: applyProgress(from, progress),
  });
}

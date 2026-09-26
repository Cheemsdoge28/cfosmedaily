import { NextResponse, type NextRequest } from "next/server";

import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { frequencyLabel, statusLabel } from "@/lib/tasks/format";
import { requireTaskScope, taskScopeFilter } from "@/lib/tasks/scope";
import { buildWorkbook } from "@/lib/tasks/workbook";
import type { Frequency, TaskStatus } from "@/generated/prisma/enums";
import { FREQUENCY_ORDER, STATUS_ORDER } from "@/lib/tasks/types";

/**
 * Downloads the register as CFOSME_Task_Tracker_Updated.xlsx.
 *
 * The same filters the register page is showing are honoured, so what downloads is
 * what is on screen — an operator who has narrowed to one client gets that client's
 * tasks, not all eighteen.
 *
 * Scoping goes through `taskScopeFilter` like every other read, so a client login
 * cannot widen the export by editing the query string. The download is audited: a
 * file leaving the system with client data in it is worth a line in the log.
 *
 * `force-dynamic` because the response depends on the session cookie and must
 * never be cached — a cached workbook is one client's register served to another.
 */
export const dynamic = "force-dynamic";

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export async function GET(request: NextRequest) {
  const scope = await requireTaskScope();
  const params = request.nextUrl.searchParams;

  const owner = params.get("owner")?.trim() || undefined;
  const process = params.get("process")?.trim() || undefined;
  const status = pick<TaskStatus>(params.get("status"), STATUS_ORDER);
  const frequency = pick<Frequency>(params.get("freq"), FREQUENCY_ORDER);

  const tasks = await prisma.task.findMany({
    where: {
      ...taskScopeFilter(scope, params.get("client")),
      ...(owner ? { owner } : {}),
      ...(process ? { process } : {}),
      ...(status ? { status } : {}),
      ...(frequency ? { frequency } : {}),
    },
    include: {
      client: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
    orderBy: [{ client: { name: "asc" } }, { reference: "asc" }],
  });

  const buffer = await buildWorkbook(
    tasks.map((task) => ({
      reference: task.reference,
      clientName: task.client.name,
      process: task.process,
      activity: task.activity,
      description: task.description,
      owner: task.owner,
      // Written back as the words the practice uses, not the enum keys, so the
      // file that comes out can go straight back in.
      frequency: frequencyLabel(task.frequency),
      dueRule: task.dueRule,
      dueDate: task.dueDate,
      dueText: task.dueText,
      status: statusLabel(task.status),
      progress: task.progress,
      notes: task.notes,
      updatedByName: task.updatedBy?.name ?? null,
      updatedAt: task.statusChangedAt,
    })),
  );

  await recordAudit({
    action: "export.download",
    userId: scope.user.id,
    clientId: scope.pinnedClientId,
    detail: `${tasks.length} tasks`,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CFOSME_Task_Tracker_${stamp}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

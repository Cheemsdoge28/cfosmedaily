import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * Append-only audit trail. Covers the events the runbook asks to be able to
 * trace: sign-ins, password changes, user administration, every workbook import
 * and every move a task makes.
 */

export type AuditAction =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.login.locked"
  | "auth.logout"
  | "auth.password.change"
  | "user.create"
  | "user.update"
  | "user.password.reset"
  | "user.deactivate"
  | "user.remove"
  | "user.restore"
  | "access.grant"
  | "access.update"
  | "access.revoke"
  | "client.create"
  | "client.update"
  | "task.update"
  | "import.start"
  | "import.success"
  | "import.failure"
  | "export.download";

/**
 * Several entries at once, as one insert.
 *
 * A bulk access change writes one row per client, and doing that through
 * `recordAudit` in a loop is a network round trip each — eighteen of them
 * against a hosted database is slower than the change itself. The request
 * headers are the same for every row in a batch, so they are read once.
 */
export async function recordAuditBatch(
  entries: {
    action: AuditAction;
    userId?: string | null;
    clientId?: string | null;
    detail?: string | null;
  }[],
): Promise<void> {
  if (entries.length === 0) return;

  const { ipAddress, userAgent } = await requestMeta();

  try {
    await prisma.auditLog.createMany({
      data: entries.map((entry) => ({
        action: entry.action,
        userId: entry.userId ?? null,
        clientId: entry.clientId ?? null,
        detail: entry.detail ?? null,
        ipAddress,
        userAgent,
      })),
    });
  } catch (error) {
    // Auditing must never break the action it is recording.
    console.error("[audit] failed to record a batch", error);
  }
}

/** The caller's IP and user agent, or nulls outside a request scope. */
async function requestMeta(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const headerList = await headers();
    return {
      ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
    };
  } catch {
    // Outside a request scope (e.g. a script) there are no headers.
    return { ipAddress: null, userAgent: null };
  }
}

export async function recordAudit(input: {
  action: AuditAction;
  userId?: string | null;
  clientId?: string | null;
  detail?: string | null;
}): Promise<void> {
  const { ipAddress, userAgent } = await requestMeta();

  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId ?? null,
        clientId: input.clientId ?? null,
        detail: input.detail ?? null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Auditing must never break the user-facing action it is recording.
    console.error("[audit] failed to record", input.action, error);
  }
}

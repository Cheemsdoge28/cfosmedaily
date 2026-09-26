import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";

/**
 * Append-only audit trail. Covers the events the SOP asks to be able to trace:
 * sign-ins, password changes, user administration and every Zoho sync.
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
  | "client.create"
  | "client.update"
  | "zoho.connect"
  | "zoho.disconnect"
  | "zoho.sync.start"
  | "zoho.sync.success"
  | "zoho.sync.failure";

export async function recordAudit(input: {
  action: AuditAction;
  userId?: string | null;
  clientId?: string | null;
  detail?: string | null;
}): Promise<void> {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  try {
    const headerList = await headers();
    ipAddress = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    userAgent = headerList.get("user-agent")?.slice(0, 500) ?? null;
  } catch {
    // Outside a request scope (e.g. the cron job) there are no headers.
  }

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

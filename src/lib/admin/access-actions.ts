"use server";

import { revalidatePath } from "next/cache";

import { recordAudit, recordAuditBatch } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { revokeAllSessions } from "@/lib/auth/session";
import { accessLevelLabel } from "@/lib/admin/labels";
import { INITIAL_ADMIN_STATE, type AdminState } from "@/lib/admin/types";
import { prisma } from "@/lib/db";
import type { AccessLevel } from "@/generated/prisma/enums";

/**
 * Changing what one person can reach.
 *
 * This is one action over the whole list rather than a grant-one-client action
 * called repeatedly, and that is the entire point. The earlier version had four
 * — grant, revoke, change level, grant-all — each its own form and its own round
 * trip, so putting a reviewer on six clients meant six submits, and every one of
 * them re-rendered the page and reset the picker you were working in. Setting
 * six clients is one decision; it should be one save.
 *
 * The form sends a level for *every* client, and the server diffs that against
 * what is stored. So the payload describes the desired end state rather than a
 * sequence of edits, which means a double submit is harmless and two
 * administrators saving the same screen cannot interleave into something neither
 * of them asked for.
 *
 * Rules that still hold, as before:
 *
 *   1. Only a platform admin may call these, checked on entry, every time.
 *   2. Every individual change is audited against both the person and the
 *      client, because "who could see this client in March" is the question that
 *      gets asked. A bulk save writes one row per change, not one for the batch.
 *   3. Taking access away does not wait for a session to expire — grants are
 *      read from the database per request.
 *
 * A platform admin holds no grants: their reach comes from the role, so these
 * refuse to touch such an account.
 */

function fail(error: string): AdminState {
  return { ...INITIAL_ADMIN_STATE, error };
}

/** What a row of the editor can be set to. */
const LEVELS = new Set(["NONE", "VIEW", "EDIT"]);

type MemberTarget =
  | { ok: true; user: { id: string; name: string; email: string; role: string } }
  | { ok: false; error: string };

async function loadMember(userId: string): Promise<MemberTarget> {
  if (!userId) return { ok: false, error: "No account selected." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return { ok: false, error: "That account no longer exists." };

  if (user.role === "PLATFORM_ADMIN") {
    return {
      ok: false,
      error:
        "CFOSME staff accounts read every client through their role, so they hold no per-client grants.",
    };
  }

  return { ok: true, user };
}

/**
 * Applies the access list as submitted.
 *
 * Fields are named `access:<clientId>` and carry NONE, VIEW or EDIT. Every client
 * the editor showed is present, so a client whose field is missing is simply left
 * alone rather than being treated as a removal — which matters if a client is
 * onboarded while somebody has the page open.
 */
export async function setClientAccessAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const target = await loadMember(String(formData.get("userId") ?? ""));
  if (!target.ok) return fail(target.error);

  // ── What was asked for ────────────────────────────────────────────────────
  const desired = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("access:")) continue;
    const clientId = key.slice("access:".length);
    const level = String(value);
    if (!clientId || !LEVELS.has(level)) continue;
    desired.set(clientId, level);
  }

  if (desired.size === 0) return fail("Nothing was submitted to change.");

  // ── What is stored ────────────────────────────────────────────────────────
  const [existing, clients] = await Promise.all([
    prisma.clientAccess.findMany({
      where: { userId: target.user.id },
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      where: { id: { in: [...desired.keys()] } },
      select: { id: true, name: true },
    }),
  ]);

  const names = new Map(clients.map((client) => [client.id, client.name]));
  const current = new Map(existing.map((grant) => [grant.clientId, grant]));

  // A client id that no longer exists is dropped rather than failing the save:
  // the rest of the change is still what the operator meant.
  for (const clientId of [...desired.keys()]) {
    if (!names.has(clientId)) desired.delete(clientId);
  }

  // ── The diff ──────────────────────────────────────────────────────────────
  //
  // Collected as id lists per operation, not as one statement per client. The
  // first version issued a statement per row inside an interactive transaction,
  // which is eighteen network round trips against a hosted database — and it
  // duly blew Prisma's 5s transaction timeout on a full save. Grouping makes it
  // four statements whatever the client count.
  const toDelete: string[] = [];
  const toCreate: { clientId: string; level: AccessLevel }[] = [];
  const toSet: Record<AccessLevel, string[]> = { VIEW: [], EDIT: [] };

  const created: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];

  const audits: {
    action: "access.grant" | "access.update" | "access.revoke";
    clientId: string;
    detail: string;
  }[] = [];

  for (const [clientId, level] of desired) {
    const held = current.get(clientId);
    const name = names.get(clientId)!;

    if (level === "NONE") {
      if (!held) continue;
      toDelete.push(clientId);
      audits.push({
        action: "access.revoke",
        clientId,
        detail: `${target.user.email} lost access to ${name}`,
      });
      removed.push(name);
      continue;
    }

    const next = level as AccessLevel;

    if (!held) {
      toCreate.push({ clientId, level: next });
      audits.push({
        action: "access.grant",
        clientId,
        detail: `${target.user.email} granted ${accessLevelLabel(next)} on ${name}`,
      });
      created.push(name);
      continue;
    }

    if (held.level !== next) {
      toSet[next].push(clientId);
      audits.push({
        action: "access.update",
        clientId,
        detail: `${target.user.email} on ${name}: ${accessLevelLabel(held.level)} → ${accessLevelLabel(next)}`,
      });
      updated.push(name);
    }
  }

  const changeCount = toDelete.length + toCreate.length + toSet.VIEW.length + toSet.EDIT.length;

  if (changeCount === 0) {
    return { ...INITIAL_ADMIN_STATE, success: "No changes to save." };
  }

  // One transaction, as an array rather than a callback: the statements are sent
  // together instead of a round trip apiece, which is both faster and what keeps
  // a full eighteen-client save inside the transaction timeout.
  await prisma.$transaction([
    ...(toDelete.length
      ? [
          prisma.clientAccess.deleteMany({
            where: { userId: target.user.id, clientId: { in: toDelete } },
          }),
        ]
      : []),
    ...(["VIEW", "EDIT"] as const)
      .filter((level) => toSet[level].length > 0)
      .map((level) =>
        prisma.clientAccess.updateMany({
          where: { userId: target.user.id, clientId: { in: toSet[level] } },
          data: { level, grantedById: admin.id },
        }),
      ),
    ...(toCreate.length
      ? [
          prisma.clientAccess.createMany({
            data: toCreate.map((entry) => ({
              userId: target.user.id,
              clientId: entry.clientId,
              level: entry.level,
              grantedById: admin.id,
            })),
          }),
        ]
      : []),
  ]);

  // Audited per client rather than per save — a single "changed 6 clients" row
  // would not answer the question the log exists to answer — but written as one
  // insert, for the same reason the writes above are grouped.
  await recordAuditBatch(
    audits.map((entry) => ({
      action: entry.action,
      userId: admin.id,
      clientId: entry.clientId,
      detail: entry.detail,
    })),
  );

  // Left with nothing is the shape of "this person should not be in here at
  // all", so it ends their sessions rather than leaving them on a page that has
  // just become empty.
  const remaining = await prisma.clientAccess.count({
    where: { userId: target.user.id },
  });
  if (remaining === 0) await revokeAllSessions(target.user.id);

  revalidatePath(`/admin/users/${target.user.id}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");

  const parts: string[] = [];
  if (created.length) parts.push(`${created.length} added`);
  if (updated.length) parts.push(`${updated.length} changed`);
  if (removed.length) parts.push(`${removed.length} removed`);

  const tail =
    remaining === 0
      ? ` ${target.user.name} now has no client access and has been signed out.`
      : " It takes effect on their next page load.";

  return {
    ...INITIAL_ADMIN_STATE,
    success: `Saved — ${parts.join(", ")}.${tail}`,
  };
}

/** Ends one session, or all of them, for one account. */
export async function revokeSessionsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return fail("That account no longer exists.");

  if (sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!session || session.userId !== userId) {
      return fail("That session no longer exists.");
    }
    if (session.revokedAt) return fail("That session has already ended.");

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      action: "user.update",
      userId: admin.id,
      detail: `signed out one session of ${user.email}`,
    });
  } else {
    await revokeAllSessions(userId);
    await recordAudit({
      action: "user.update",
      userId: admin.id,
      detail: `signed out every session of ${user.email}`,
    });
  }

  revalidatePath(`/admin/users/${userId}`);

  return {
    ...INITIAL_ADMIN_STATE,
    success: sessionId
      ? "That session has been signed out."
      : `${user.name} has been signed out everywhere.`,
  };
}

/**
 * Promotes a member to CFOSME staff, or demotes one back.
 *
 * Promoting drops the person's grants, because a platform admin reads every
 * client by role and leaving stale rows behind would make the access screen lie
 * about why they can see things. Demoting therefore leaves an account with no
 * access at all, which the message says, so nobody demotes someone and assumes
 * they kept their old clients.
 */
export async function setRoleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (role !== "PLATFORM_ADMIN" && role !== "MEMBER") {
    return fail("Choose a valid role.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return fail("That account no longer exists.");
  if (user.role === role) return fail("That account already has that role.");

  if (user.id === admin.id) {
    // Otherwise the last administrator can lock themselves out of the screen
    // they would need in order to undo it.
    return fail("You cannot change your own role.");
  }

  if (role === "MEMBER") {
    const staffLeft = await prisma.user.count({
      where: { role: "PLATFORM_ADMIN", isActive: true, id: { not: user.id } },
    });
    if (staffLeft === 0) {
      return fail(
        "That is the only remaining CFOSME staff account. Promote someone else first.",
      );
    }
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role } }),
    // Promoting: the grants are now redundant. Demoting: there are none to clear.
    prisma.clientAccess.deleteMany({ where: { userId: user.id } }),
  ]);

  await revokeAllSessions(user.id);

  await recordAudit({
    action: "user.update",
    userId: admin.id,
    detail: `${user.email} role ${user.role} → ${role}`,
  });

  revalidatePath(`/admin/users/${user.id}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");

  return {
    ...INITIAL_ADMIN_STATE,
    success:
      role === "PLATFORM_ADMIN"
        ? `${user.name} is now CFOSME staff and reads every client. Their per-client grants were removed as redundant, and they were signed out.`
        : `${user.name} is now a member with no client access yet — grant the clients they need below. They were signed out.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Removal — a mark, never a delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Removes an account from view.
 *
 * Deliberately not a delete. Everything the account is referenced from stays
 * exactly where it is: the audit entries it wrote, the tasks it moved, the
 * workbook imports it ran, and the client grants it held. Hard-deleting the row
 * would take "who moved this task to Done in September" with it, and that is the
 * one question the register exists to answer.
 *
 * What removal actually does is make the account unreachable — it cannot sign
 * in, its live sessions end immediately, and it drops out of every listing
 * except the administration screen that can restore it.
 *
 * The grants are kept rather than cleared, for two reasons: they are part of the
 * record of what this person could see and when, and keeping them makes a
 * restore put the account back exactly as it was instead of silently blank. They
 * are inert while the mark is set, because the session lookup refuses the
 * account before any grant is ever read.
 */
export async function removeUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      deletedAt: true,
      _count: { select: { access: true } },
    },
  });
  if (!user) return fail("That account no longer exists.");
  if (user.deletedAt) return fail("That account has already been removed.");

  if (user.id === admin.id) {
    return fail("You cannot remove your own account.");
  }

  if (user.role === "PLATFORM_ADMIN") {
    const staffLeft = await prisma.user.count({
      where: {
        role: "PLATFORM_ADMIN",
        isActive: true,
        deletedAt: null,
        id: { not: user.id },
      },
    });
    if (staffLeft === 0) {
      return fail(
        "That is the only remaining CFOSME staff account. Promote someone else before removing it.",
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: new Date(), deletedById: admin.id },
  });

  // The mark alone would already end their access on the next request; ending
  // the sessions now means it takes effect on the current one too.
  await revokeAllSessions(user.id);

  await recordAudit({
    action: "user.remove",
    userId: admin.id,
    detail: `${user.email} removed — history kept, ${user._count.access} client grant(s) retained`,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
  revalidatePath("/admin");

  return {
    ...INITIAL_ADMIN_STATE,
    success: `${user.name} has been removed and signed out. Their history is kept, and the account can be restored.`,
  };
}

/** Brings a removed account back, with the access it had. */
export async function restoreUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      deletedAt: true,
      _count: { select: { access: true } },
    },
  });
  if (!user) return fail("That account no longer exists.");
  if (!user.deletedAt) return fail("That account has not been removed.");

  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: null, deletedById: null },
  });

  await recordAudit({
    action: "user.restore",
    userId: admin.id,
    detail: `${user.email} restored with ${user._count.access} client grant(s)`,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
  revalidatePath("/admin");

  const caveat = user.isActive
    ? ""
    : " The account is still deactivated, so reactivate it before they can sign in.";

  return {
    ...INITIAL_ADMIN_STATE,
    success: `${user.name} is back, with the ${user._count.access} client grant(s) they had.${caveat}`,
  };
}

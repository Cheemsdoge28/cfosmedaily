"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { revokeAllSessions } from "@/lib/auth/session";
import { accessLevelLabel } from "@/lib/admin/labels";
import { INITIAL_ADMIN_STATE, type AdminState } from "@/lib/admin/types";
import { prisma } from "@/lib/db";

/**
 * Granting and revoking a person's access to a client.
 *
 * These live apart from the rest of the admin actions because they are the
 * security-sensitive ones: every call decides what somebody can see. Three rules
 * hold across all of them.
 *
 *   1. Only a platform admin may call them, checked on entry, every time.
 *   2. Every change is audited against both the person and the client, because
 *      "who could see this client in March" is the question that gets asked.
 *   3. Taking access away does not wait for a session to expire. The session
 *      reads its grants from the database on every request, so a revoke is
 *      effective on that person's next page load — which is why `getSessionUser`
 *      joins the grants rather than caching them into the cookie.
 *
 * A platform admin deliberately holds no grants: their reach comes from the role.
 * Granting one would be redundant on the day it was made and misleading the day a
 * new client was onboarded, so these refuse to touch such an account.
 */

function fail(error: string): AdminState {
  return { ...INITIAL_ADMIN_STATE, error };
}

const levelSchema = z.enum(["VIEW", "EDIT"]);

/**
 * Loads the target and refuses the cases that should never be grant-managed.
 *
 * Tagged with `ok` rather than relying on `"error" in target`: the narrowing
 * reads the same at the call site but leaves `error` a plain string, so a caller
 * cannot pass `undefined` into a message.
 */
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

/** Gives one person access to one client, or changes the level if they have it. */
export async function grantAccessAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const target = await loadMember(String(formData.get("userId") ?? ""));
  if (!target.ok) return fail(target.error);

  const clientId = String(formData.get("clientId") ?? "");
  const parsedLevel = levelSchema.safeParse(formData.get("level"));
  if (!clientId) return fail("Choose a client.");
  if (!parsedLevel.success) return fail("Choose view or edit.");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) return fail("That client no longer exists.");

  const existing = await prisma.clientAccess.findUnique({
    where: { userId_clientId: { userId: target.user.id, clientId } },
    select: { level: true },
  });

  await prisma.clientAccess.upsert({
    where: { userId_clientId: { userId: target.user.id, clientId } },
    update: { level: parsedLevel.data, grantedById: admin.id },
    create: {
      userId: target.user.id,
      clientId,
      level: parsedLevel.data,
      grantedById: admin.id,
    },
  });

  await recordAudit({
    action: existing ? "access.update" : "access.grant",
    userId: admin.id,
    clientId,
    detail: existing
      ? `${target.user.email} on ${client.name}: ${accessLevelLabel(existing.level)} → ${accessLevelLabel(parsedLevel.data)}`
      : `${target.user.email} granted ${accessLevelLabel(parsedLevel.data)} on ${client.name}`,
  });

  revalidatePath(`/admin/users/${target.user.id}`);
  revalidatePath("/admin");

  return {
    ...INITIAL_ADMIN_STATE,
    success: existing
      ? `${client.name} is now ${accessLevelLabel(parsedLevel.data).toLowerCase()} for ${target.user.name}.`
      : `${target.user.name} can now see ${client.name} (${accessLevelLabel(parsedLevel.data).toLowerCase()}).`,
  };
}

/** Takes one client away from one person. */
export async function revokeAccessAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const target = await loadMember(String(formData.get("userId") ?? ""));
  if (!target.ok) return fail(target.error);

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return fail("No client selected.");

  const grant = await prisma.clientAccess.findUnique({
    where: { userId_clientId: { userId: target.user.id, clientId } },
    include: { client: { select: { name: true } } },
  });
  if (!grant) return fail("That access has already been removed.");

  await prisma.clientAccess.delete({ where: { id: grant.id } });

  await recordAudit({
    action: "access.revoke",
    userId: admin.id,
    clientId,
    detail: `${target.user.email} lost access to ${grant.client.name}`,
  });

  revalidatePath(`/admin/users/${target.user.id}`);
  revalidatePath("/admin");

  return {
    ...INITIAL_ADMIN_STATE,
    success: `${target.user.name} can no longer see ${grant.client.name}. It takes effect on their next page load.`,
  };
}

/**
 * Grants every active client at one level.
 *
 * For the common case of a CFOSME reviewer who covers the whole book but should
 * not be a platform admin. It is a snapshot, not a standing rule: clients
 * onboarded later are not included, which the success message says plainly so
 * nobody assumes otherwise.
 */
export async function grantAllClientsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const target = await loadMember(String(formData.get("userId") ?? ""));
  if (!target.ok) return fail(target.error);

  const parsedLevel = levelSchema.safeParse(formData.get("level"));
  if (!parsedLevel.success) return fail("Choose view or edit.");

  const clients = await prisma.client.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (clients.length === 0) return fail("There are no active clients to grant.");

  // createMany with skipDuplicates leaves an existing grant's level alone, which
  // is the safer reading of "grant all": it adds what is missing rather than
  // quietly promoting a VIEW grant somebody set deliberately.
  const result = await prisma.clientAccess.createMany({
    data: clients.map((client) => ({
      userId: target.user.id,
      clientId: client.id,
      level: parsedLevel.data,
      grantedById: admin.id,
    })),
    skipDuplicates: true,
  });

  await recordAudit({
    action: "access.grant",
    userId: admin.id,
    detail: `${target.user.email} granted ${accessLevelLabel(parsedLevel.data)} on ${result.count} client(s) in bulk`,
  });

  revalidatePath(`/admin/users/${target.user.id}`);
  revalidatePath("/admin");

  return {
    ...INITIAL_ADMIN_STATE,
    success:
      result.count === 0
        ? `${target.user.name} already had access to every active client. Existing levels were left as they are.`
        : `Added ${result.count} client(s) for ${target.user.name} at ${accessLevelLabel(parsedLevel.data).toLowerCase()}. Clients onboarded later are not included automatically.`,
  };
}

/** Removes every grant at once, and signs the person out. */
export async function revokeAllAccessAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const target = await loadMember(String(formData.get("userId") ?? ""));
  if (!target.ok) return fail(target.error);

  const removed = await prisma.clientAccess.deleteMany({
    where: { userId: target.user.id },
  });
  if (removed.count === 0) return fail("That account had no access to remove.");

  // Removing everything is the shape of "this person should not be in here at
  // all", so it ends their sessions rather than leaving them on a page that has
  // become empty.
  await revokeAllSessions(target.user.id);

  await recordAudit({
    action: "access.revoke",
    userId: admin.id,
    detail: `${target.user.email} lost all ${removed.count} client grant(s), and was signed out`,
  });

  revalidatePath(`/admin/users/${target.user.id}`);
  revalidatePath("/admin");

  return {
    ...INITIAL_ADMIN_STATE,
    success: `Removed all ${removed.count} grant(s) from ${target.user.name} and signed them out.`,
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
      ? `That session has been signed out.`
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
  revalidatePath("/admin");

  return {
    ...INITIAL_ADMIN_STATE,
    success:
      role === "PLATFORM_ADMIN"
        ? `${user.name} is now CFOSME staff and reads every client. Their per-client grants were removed as redundant, and they were signed out.`
        : `${user.name} is now a member with no client access yet — grant the clients they need below. They were signed out.`,
  };
}

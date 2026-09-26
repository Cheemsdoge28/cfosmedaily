"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { INITIAL_ADMIN_STATE, type AdminState } from "@/lib/admin/types";
import { prisma } from "@/lib/db";
import { importWorkbook } from "@/lib/tasks/import";

/**
 * Administration actions.
 *
 * Adding a client, giving its people logins, and bringing the workbook in are
 * all audited operations rather than steps in a document someone follows by hand.
 *
 * Shorter than the portal this was forked from: clients no longer carry business
 * units, fiscal years or a currency, because a task register needs none of them —
 * a client is a name, a slug and the people who may sign in. Onboarding is
 * correspondingly one form rather than four.
 */

/** A readable but high-entropy temporary password (~80 bits). */
function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  // Guarantee the policy's symbol and digit requirements.
  return `${body}#7`;
}

function fail(error: string): AdminState {
  return { ...INITIAL_ADMIN_STATE, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

const clientSchema = z.object({
  name: z.string().trim().min(2, "Enter the client name."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Use lowercase letters, digits and hyphens only."),
  legalName: z.string().trim().optional(),
  /** Optional: create the client's first login in the same step. */
  adminName: z.string().trim().optional(),
  adminEmail: z
    .union([z.string().trim().toLowerCase().email(), z.literal("")])
    .optional(),
});

/**
 * Creates a client, and optionally the first login for it.
 *
 * Most clients arrive the other way round — the importer creates them from the
 * workbook's Client column the first time it sees a name. This form is for the
 * case the import cannot cover: a client who needs a login before any of their
 * tasks exist, or one whose name in the workbook needs correcting.
 */
export async function createClientAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    legalName: formData.get("legalName"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
  });

  if (!parsed.success) return fail(parsed.error.issues[0]!.message);

  const { name, slug, legalName, adminName, adminEmail } = parsed.data;

  if (await prisma.client.findUnique({ where: { slug } })) {
    return fail(`The slug "${slug}" is already in use.`);
  }

  // The importer matches clients by name, so two clients with the same name
  // would make every future upload ambiguous.
  const sameName = await prisma.client.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { name: true },
  });
  if (sameName) {
    return fail(
      `"${sameName.name}" already exists. Workbook imports match on the client name, so two clients cannot share one.`,
    );
  }

  // Both login fields or neither.
  const wantsLogin = Boolean(adminEmail);
  if (wantsLogin && !adminName) {
    return fail("Enter a name for the first login, or leave the e-mail blank.");
  }
  if (wantsLogin && (await prisma.user.findUnique({ where: { email: adminEmail! } }))) {
    return fail("That e-mail already has an account.");
  }

  const temporaryPassword = wantsLogin ? generateTemporaryPassword() : undefined;
  const passwordHash = temporaryPassword
    ? await hashPassword(temporaryPassword)
    : undefined;

  const client = await prisma.client.create({
    data: { name, slug, legalName: legalName || null },
  });

  // The first login is a member holding one grant, not an account bound to the
  // client. The binding *is* the grant, so it can be added to later.
  if (wantsLogin && passwordHash) {
    await prisma.user.create({
      data: {
        name: adminName!,
        email: adminEmail!,
        role: "MEMBER",
        passwordHash,
        mustChangePassword: true,
        access: {
          create: { clientId: client.id, level: "EDIT", grantedById: admin.id },
        },
      },
    });
  }

  await recordAudit({
    action: "client.create",
    userId: admin.id,
    clientId: client.id,
    detail: `${name} (${slug})`,
  });

  if (wantsLogin) {
    await recordAudit({
      action: "user.create",
      userId: admin.id,
      clientId: client.id,
      detail: `${adminEmail} created with the client, granted Can edit on it`,
    });
  }

  revalidatePath("/admin");

  return {
    error: null,
    clientId: client.id,
    temporaryPassword,
    success: wantsLogin
      ? `${name} created, with a login for ${adminEmail}. Their tasks appear as soon as a workbook naming them is imported.`
      : `${name} created. Their tasks appear as soon as a workbook naming them is imported.`,
  };
}

/** Suspends a client, or brings one back. A suspended register is read-only. */
export async function toggleClientActiveAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const clientId = String(formData.get("clientId") ?? "");
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return fail("That client no longer exists.");

  const isActive = !client.isActive;
  await prisma.client.update({ where: { id: clientId }, data: { isActive } });

  // Suspending a client must not leave its people holding live sessions. They are
  // found through the grant table now. A suspended client also drops out of
  // getSessionUser, so anyone with no other client sees an empty register rather
  // than stale figures.
  if (!isActive) {
    const grants = await prisma.clientAccess.findMany({
      where: { clientId },
      select: { userId: true },
    });
    for (const grant of grants) await revokeAllSessions(grant.userId);
  }

  await recordAudit({
    action: "client.update",
    userId: admin.id,
    clientId,
    detail: `${client.name} -> ${isActive ? "active" : "suspended"}`,
  });

  revalidatePath("/admin");
  return {
    ...INITIAL_ADMIN_STATE,
    success: `${client.name} is now ${isActive ? "active" : "suspended"}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logins
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name."),
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail address."),
  /**
   * The first client and its level, both optional: an account can be created now
   * and granted its clients afterwards on its own page, which is how a reviewer
   * covering several clients is set up.
   */
  clientId: z.string().optional(),
  level: z.enum(["VIEW", "EDIT"]).default("VIEW"),
});

export async function createUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    clientId: formData.get("clientId"),
    level: formData.get("level") ?? "VIEW",
  });

  if (!parsed.success) return fail(parsed.error.issues[0]!.message);

  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
    return fail("That e-mail already has an account.");
  }

  // "none" is the sentinel the form uses for "grant the clients later", because a
  // select cannot carry an empty value.
  const firstClient =
    parsed.data.clientId && parsed.data.clientId !== "none"
      ? parsed.data.clientId
      : null;

  if (firstClient) {
    const exists = await prisma.client.findUnique({
      where: { id: firstClient },
      select: { id: true },
    });
    if (!exists) return fail("That client no longer exists.");
  }

  const temporaryPassword = generateTemporaryPassword();

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: "MEMBER",
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      ...(firstClient
        ? {
            access: {
              create: {
                clientId: firstClient,
                level: parsed.data.level,
                grantedById: admin.id,
              },
            },
          }
        : {}),
    },
  });

  await recordAudit({
    action: "user.create",
    userId: admin.id,
    clientId: firstClient,
    detail: firstClient
      ? `${parsed.data.email} created with ${parsed.data.level} on one client`
      : `${parsed.data.email} created with no client access yet`,
  });

  revalidatePath("/admin");

  return {
    error: null,
    success: firstClient
      ? `Login created for ${user.email}. Share the temporary password over a secure channel — it is shown only once. Add further clients on their access page.`
      : `Login created for ${user.email}, with no client access yet. Grant the clients they need on their access page. The temporary password is shown only once.`,
    temporaryPassword,
  };
}

export async function resetPasswordAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return fail("No user selected.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("That user no longer exists.");

  const temporaryPassword = generateTemporaryPassword();

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  // A reset must invalidate anything issued under the old password.
  await revokeAllSessions(userId);

  await recordAudit({
    action: "user.password.reset",
    userId: admin.id,
    detail: user.email,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${user.id}`);

  return {
    error: null,
    success: `Password reset for ${user.email}. All of their sessions were signed out.`,
    temporaryPassword,
  };
}

export async function toggleUserActiveAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("That user no longer exists.");

  if (user.id === admin.id) {
    return fail("You cannot deactivate your own account.");
  }

  const isActive = !user.isActive;
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  if (!isActive) await revokeAllSessions(userId);

  await recordAudit({
    action: isActive ? "user.update" : "user.deactivate",
    userId: admin.id,
    detail: `${user.email} -> ${isActive ? "active" : "inactive"}`,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${user.id}`);

  return {
    ...INITIAL_ADMIN_STATE,
    success: `${user.email} is now ${isActive ? "active" : "deactivated"}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workbook import
// ─────────────────────────────────────────────────────────────────────────────

/** 8 MB. The register is ~90 rows; a file far past this is not this workbook. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const XLSX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  // Some browsers send nothing useful; the extension check below covers those.
  "application/octet-stream",
  "",
]);

/**
 * Takes the uploaded workbook and brings it into the register.
 *
 * The period matters and is asked for rather than assumed: the Due Date column
 * holds values like "20th Sept" with no year, so the month the register is *for*
 * is what resolves them. Defaulting it to the current month would mean the same
 * file imported in October produced different deadlines than it did in September.
 */
export async function importWorkbookAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const file = formData.get("workbook");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose the CFOSME_Task_Tracker.xlsx file to upload.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("That file is larger than 8 MB — check it is the task tracker workbook.");
  }
  if (!XLSX_TYPES.has(file.type) && !/\.xlsx?$/i.test(file.name)) {
    return fail("That is not an Excel workbook (.xlsx).");
  }

  const period = String(formData.get("period") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return fail("Choose the month this workbook covers.");
  }
  const [year, month] = period.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return fail("Choose the month this workbook covers.");
  }

  const outcome = await importWorkbook({
    buffer: await file.arrayBuffer(),
    fileName: file.name,
    userId: admin.id,
    context: { year, month },
  });

  revalidatePath("/admin/import");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/register");

  if (outcome.status === "FAILED") {
    return fail(outcome.errors[0] ?? "The workbook could not be imported.");
  }

  const parts = [
    `${outcome.created} created`,
    `${outcome.updated} updated`,
    `${outcome.unchanged} unchanged`,
  ];
  if (outcome.skipped) parts.push(`${outcome.skipped} skipped`);

  const newClients = outcome.clientsCreated.length
    ? ` New client${outcome.clientsCreated.length === 1 ? "" : "s"}: ${outcome.clientsCreated.join(", ")}.`
    : "";

  const caveat = outcome.skipped
    ? " The rows it could not read are listed below — fix them in the workbook and upload again."
    : "";

  return {
    ...INITIAL_ADMIN_STATE,
    success: `${file.name}: ${parts.join(", ")}.${newClients}${caveat}`,
  };
}

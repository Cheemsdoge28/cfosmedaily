"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import {
  buildFiscalYear,
  buildFiscalYearSpan,
  fiscalYearStartFor,
} from "@/lib/admin/fiscal-years";
import { INITIAL_ADMIN_STATE, type AdminState } from "@/lib/admin/types";
import { prisma } from "@/lib/db";
import { listOrganizations } from "@/lib/zoho/client";
import { SyncInProgressError, syncClientFromZoho } from "@/lib/zoho/sync";

/**
 * Administration actions — the onboarding flow.
 *
 * These replace the legacy SOP steps that asked an operator to hand-edit
 * config.php and paste in a bcrypt hash. Adding a client, giving its people
 * logins and pulling its figures from Zoho are now audited operations.
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
  currency: z.string().trim().length(3, "Use a 3-letter currency code.").toUpperCase(),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  businessUnits: z.string().trim().optional(),
  historyYears: z.coerce.number().int().min(1).max(5).default(2),
  /** Optional: create the client's first login in the same step. */
  adminName: z.string().trim().optional(),
  adminEmail: z
    .union([z.string().trim().toLowerCase().email(), z.literal("")])
    .optional(),
});

/**
 * Creates a client complete enough to be usable:
 * business units, fiscal years, a Zoho connection row, and optionally the first
 * client-administrator login.
 *
 * Fiscal years matter here — without one the dashboard has nothing to resolve
 * its filters against and a Zoho sync refuses every month.
 */
export async function createClientAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    currency: formData.get("currency"),
    fiscalYearStartMonth: formData.get("fiscalYearStartMonth"),
    businessUnits: formData.get("businessUnits"),
    historyYears: formData.get("historyYears"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
  });

  if (!parsed.success) return fail(parsed.error.issues[0]!.message);

  const {
    name,
    slug,
    currency,
    fiscalYearStartMonth,
    historyYears,
    adminName,
    adminEmail,
  } = parsed.data;

  if (await prisma.client.findUnique({ where: { slug } })) {
    return fail(`The slug "${slug}" is already in use.`);
  }

  // Both login fields or neither.
  const wantsLogin = Boolean(adminEmail);
  if (wantsLogin && !adminName) {
    return fail("Enter a name for the first login, or leave the e-mail blank.");
  }
  if (wantsLogin && (await prisma.user.findUnique({ where: { email: adminEmail! } }))) {
    return fail("That e-mail already has an account.");
  }

  const units = (parsed.data.businessUnits ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  const { years, currentLabel } = buildFiscalYearSpan({
    startMonth: fiscalYearStartMonth,
    back: historyYears - 1,
  });

  const temporaryPassword = wantsLogin ? generateTemporaryPassword() : undefined;
  const passwordHash = temporaryPassword
    ? await hashPassword(temporaryPassword)
    : undefined;

  const client = await prisma.client.create({
    data: {
      name,
      slug,
      currency,
      fiscalYearStartMonth,
      businessUnits: {
        create: (units.length ? units : ["Consolidated"]).map((unitName, index) => ({
          name: unitName,
          sortOrder: index,
        })),
      },
      fiscalYears: {
        create: years.map((fy) => ({
          label: fy.label,
          startDate: new Date(`${fy.startDate}T00:00:00Z`),
          endDate: new Date(`${fy.endDate}T00:00:00Z`),
          isCurrent: fy.label === currentLabel,
        })),
      },
      zohoConnection: { create: {} },
      ...(wantsLogin && passwordHash
        ? {
            users: {
              create: {
                name: adminName!,
                email: adminEmail!,
                role: "CLIENT_ADMIN",
                passwordHash,
                mustChangePassword: true,
              },
            },
          }
        : {}),
    },
  });

  await recordAudit({
    action: "client.create",
    userId: admin.id,
    clientId: client.id,
    detail: `${name} (${slug}) — ${years.length} fiscal years, ${units.length || 1} unit(s)`,
  });

  if (wantsLogin) {
    await recordAudit({
      action: "user.create",
      userId: admin.id,
      clientId: client.id,
      detail: `${adminEmail} as CLIENT_ADMIN (created with client)`,
    });
  }

  revalidatePath("/admin");

  return {
    error: null,
    clientId: client.id,
    temporaryPassword,
    success: wantsLogin
      ? `${name} created with ${years.length} fiscal years and a login for ${adminEmail}. Connect Zoho Books next.`
      : `${name} created with ${years.length} fiscal years. Add a login next.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Business units and fiscal years
// ─────────────────────────────────────────────────────────────────────────────

export async function addBusinessUnitAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!clientId || name.length < 2) return fail("Enter a business unit name.");

  const existing = await prisma.businessUnit.findUnique({
    where: { clientId_name: { clientId, name } },
  });
  if (existing) return fail(`"${name}" already exists for this client.`);

  const count = await prisma.businessUnit.count({ where: { clientId } });

  await prisma.businessUnit.create({
    data: { clientId, name, sortOrder: count },
  });

  await recordAudit({
    action: "client.update",
    userId: admin.id,
    clientId,
    detail: `added business unit ${name}`,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ...INITIAL_ADMIN_STATE, success: `Business unit "${name}" added.` };
}

/** Adds the fiscal year containing a given calendar year's start month. */
export async function addFiscalYearAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const clientId = String(formData.get("clientId") ?? "");
  const startYear = Number(formData.get("startYear"));

  if (!clientId) return fail("No client selected.");
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    return fail("Enter a year between 2000 and 2100.");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return fail("That client no longer exists.");

  const fy = buildFiscalYear(startYear, client.fiscalYearStartMonth);

  const existing = await prisma.fiscalYear.findUnique({
    where: { clientId_label: { clientId, label: fy.label } },
  });
  if (existing) return fail(`${fy.label} already exists.`);

  const currentStart = fiscalYearStartFor(new Date(), client.fiscalYearStartMonth);

  await prisma.fiscalYear.create({
    data: {
      clientId,
      label: fy.label,
      startDate: new Date(`${fy.startDate}T00:00:00Z`),
      endDate: new Date(`${fy.endDate}T00:00:00Z`),
      isCurrent: startYear === currentStart,
    },
  });

  await recordAudit({
    action: "client.update",
    userId: admin.id,
    clientId,
    detail: `added fiscal year ${fy.label}`,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ...INITIAL_ADMIN_STATE, success: `${fy.label} added.` };
}

/** Marks one fiscal year as the default the dashboard opens on. */
export async function setCurrentFiscalYearAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const clientId = String(formData.get("clientId") ?? "");
  const fiscalYearId = String(formData.get("fiscalYearId") ?? "");
  if (!clientId || !fiscalYearId) return fail("No fiscal year selected.");

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  if (!fy || fy.clientId !== clientId) return fail("That fiscal year no longer exists.");

  await prisma.$transaction([
    prisma.fiscalYear.updateMany({ where: { clientId }, data: { isCurrent: false } }),
    prisma.fiscalYear.update({ where: { id: fiscalYearId }, data: { isCurrent: true } }),
  ]);

  await recordAudit({
    action: "client.update",
    userId: admin.id,
    clientId,
    detail: `current fiscal year set to ${fy.label}`,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ...INITIAL_ADMIN_STATE, success: `${fy.label} is now the default period.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logins — a client may have as many as it needs
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = z.object({
  clientId: z.string().min(1, "Choose a client."),
  name: z.string().trim().min(2, "Enter the person's name."),
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail address."),
  role: z.enum(["CLIENT_ADMIN", "VIEWER"]),
});

export async function createUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const parsed = userSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) return fail(parsed.error.issues[0]!.message);

  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
    return fail("That e-mail already has an account.");
  }

  const temporaryPassword = generateTemporaryPassword();

  const user = await prisma.user.create({
    data: {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
  });

  await recordAudit({
    action: "user.create",
    userId: admin.id,
    clientId: parsed.data.clientId,
    detail: `${parsed.data.email} as ${parsed.data.role}`,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${parsed.data.clientId}`);

  return {
    error: null,
    success: `Login created for ${user.email}. Share the temporary password over a secure channel — it is shown only once.`,
    temporaryPassword,
  };
}

/** Promotes a viewer to client administrator, or demotes one. */
export async function updateUserRoleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (role !== "CLIENT_ADMIN" && role !== "VIEWER") {
    return fail("Choose a valid role.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("That user no longer exists.");
  if (user.role === "PLATFORM_ADMIN") {
    return fail("Platform administrator accounts cannot be changed here.");
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });

  await recordAudit({
    action: "user.update",
    userId: admin.id,
    clientId: user.clientId,
    detail: `${user.email} role ${user.role} -> ${role}`,
  });

  revalidatePath("/admin");
  if (user.clientId) revalidatePath(`/admin/clients/${user.clientId}`);

  return {
    ...INITIAL_ADMIN_STATE,
    success: `${user.email} is now a ${role === "CLIENT_ADMIN" ? "client administrator" : "viewer"}.`,
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
    clientId: user.clientId,
    detail: user.email,
  });

  revalidatePath("/admin");
  if (user.clientId) revalidatePath(`/admin/clients/${user.clientId}`);

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
    clientId: user.clientId,
    detail: `${user.email} -> ${isActive ? "active" : "inactive"}`,
  });

  revalidatePath("/admin");
  if (user.clientId) revalidatePath(`/admin/clients/${user.clientId}`);

  return {
    ...INITIAL_ADMIN_STATE,
    success: `${user.email} is now ${isActive ? "active" : "deactivated"}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoho Books
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Binds one Zoho organization to the client.
 *
 * The callback picks the first organization it can see, which is right for an
 * account with one. Where a firm's Zoho login can see several, this is how the
 * correct one gets chosen.
 */
export async function setZohoOrganizationAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const clientId = String(formData.get("clientId") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!clientId || !organizationId) return fail("Choose an organization.");

  try {
    const organizations = await listOrganizations(clientId);
    const organization = organizations.find(
      (o) => o.organization_id === organizationId,
    );
    if (!organization) return fail("That organization is no longer visible to this connection.");

    await prisma.zohoConnection.update({
      where: { clientId },
      data: {
        organizationId: organization.organization_id,
        organizationName: organization.name,
        lastError: null,
      },
    });

    await recordAudit({
      action: "zoho.connect",
      userId: admin.id,
      clientId,
      detail: `organization set to ${organization.name}`,
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin/integrations");
    return {
      ...INITIAL_ADMIN_STATE,
      success: `Linked to ${organization.name}. Run a sync to pull its figures.`,
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not reach Zoho Books.",
    );
  }
}

/** Parses a "YYYY-MM" month input into a UTC date at the first of the month. */
function parseMonth(value: FormDataEntryValue | null): Date | undefined {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) return undefined;
  return new Date(`${text}-01T00:00:00Z`);
}

/**
 * Pulls figures from Zoho Books for an explicit period.
 *
 * A range matters on first import: a new client usually wants two full fiscal
 * years so the dashboard has a prior year to compare against, where the routine
 * nightly job only needs recent months.
 */
export async function runZohoSyncAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return fail("No client selected.");

  const from = parseMonth(formData.get("from"));
  const to = parseMonth(formData.get("to"));

  if (from && to && from > to) {
    return fail("The start month must not be after the end month.");
  }

  let result;
  try {
    result = await syncClientFromZoho({
      clientId,
      trigger: "manual",
      userId: admin.id,
      from,
      to,
    });
  } catch (error) {
    // A second click, or a manual run landing on top of the nightly job.
    if (error instanceof SyncInProgressError) return fail(error.message);
    throw error;
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/integrations");
  revalidatePath("/dashboard");

  if (result.status === "FAILED") {
    return fail(result.errors[0] ?? "The sync failed. Check the connection status.");
  }

  const tail = result.errors.length
    ? ` ${result.errors.length} period(s) reported problems — see the sync history.`
    : "";

  return {
    ...INITIAL_ADMIN_STATE,
    success: `Sync ${result.status.toLowerCase()}: ${result.monthsProcessed} months, ${result.recordsWritten} records written.${tail} Check the figures against Zoho before telling the client.`,
  };
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import {
  DUMMY_HASH,
  hashPassword,
  passwordPolicy,
  verifyPassword,
} from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  getSessionUser,
  revokeAllSessions,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * Authentication server actions.
 *
 * Next verifies the Origin header on server actions, which — together with the
 * SameSite=Lax session cookie — covers CSRF for these mutations.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Deliberately vague: never reveals whether an e-mail exists. */
const GENERIC_FAILURE = "Incorrect e-mail address or password.";

export type LoginState = { error: string | null };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail address."),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always run a bcrypt comparison so timing does not leak account existence.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = await verifyPassword(password, hash);

  // A suspended client no longer blocks a sign-in, because an account is not
  // owned by one: it is blocked from *seeing* that client, which the grant join
  // in getSessionUser does. Someone with two clients, one suspended, should still
  // be able to sign in and work on the other.
  if (!user || !user.isActive) {
    await recordAudit({
      action: "auth.login.failure",
      detail: `unknown or inactive account: ${email}`,
    });
    return { error: GENERIC_FAILURE };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAudit({ action: "auth.login.locked", userId: user.id });
    return {
      error: `This account is temporarily locked after too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
    };
  }

  if (!passwordMatches) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null,
      },
    });

    await recordAudit({
      action: shouldLock ? "auth.login.locked" : "auth.login.failure",
      userId: user.id,
      detail: `failed attempt ${failedLoginCount}`,
    });

    return { error: GENERIC_FAILURE };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  await createSession(user.id);
  await recordAudit({ action: "auth.login.success", userId: user.id });

  // Everyone lands on the dashboard. Staff used to be sent to /admin because
  // they had no client of their own and the dashboard had nothing to show them;
  // it now reads across every client, so it is the right first screen for them too.
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  await destroySession();

  if (user) {
    await recordAudit({ action: "auth.logout", userId: user.id });
  }

  redirect("/login");
}

export type ChangePasswordState = { error: string | null; success: boolean };

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The new passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "The new password must be different from the current one.",
    path: ["newPassword"],
  });

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Could not change the password.",
      success: false,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) redirect("/login");

  const matches = await verifyPassword(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!matches) {
    return { error: "Your current password is incorrect.", success: false };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
    },
  });

  // Every other device is signed out; the current session is re-issued below.
  await revokeAllSessions(user.id);
  await createSession(user.id);

  await recordAudit({ action: "auth.password.change", userId: user.id });

  return { error: null, success: true };
}

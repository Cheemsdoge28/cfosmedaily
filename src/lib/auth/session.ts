import "server-only";

import { cookies, headers } from "next/headers";

import { randomToken, sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

/**
 * Server-side sessions.
 *
 * The browser holds an opaque random token; the database stores only its
 * SHA-256 hash, so a database dump cannot be replayed as a login. Sessions are
 * revocable (logout, admin action, password change) and expire two ways:
 *
 *   absolute  — 12 hours from issue, no matter what
 *   idle      —  2 hours without a request
 */

export const SESSION_COOKIE = "cfosme_session";

const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
/** Only touch `lastSeenAt` every few minutes to avoid a write per request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  mustChangePassword: boolean;
};

async function requestMeta() {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
  };
}

/** Issues a fresh session and sets the cookie. Called only after a successful login. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const { ipAddress, userAgent } = await requestMeta();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ABSOLUTE_LIFETIME_MS),
      ipAddress,
      userAgent,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: Math.floor(ABSOLUTE_LIFETIME_MS / 1000),
  });
}

/**
 * Resolves the caller's session, or null. Enforces revocation, absolute expiry
 * and idle timeout, and refreshes `lastSeenAt` at most every TOUCH_INTERVAL_MS.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { client: true } } },
  });

  if (!session || session.revokedAt) return null;

  const now = Date.now();
  const expired =
    session.expiresAt.getTime() < now ||
    now - session.lastSeenAt.getTime() > IDLE_TIMEOUT_MS;

  if (expired) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  if (!session.user.isActive) return null;
  if (session.user.client && !session.user.client.isActive) return null;

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clientId: user.clientId,
    clientName: user.client?.name ?? null,
    clientSlug: user.client?.slug ?? null,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Revokes the caller's session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Revokes every session for a user — used after a password change or reset. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

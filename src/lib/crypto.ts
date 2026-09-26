import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The two one-way primitives sessions are built from.
 *
 * There is deliberately no encrypt/decrypt pair here. The portal this was forked
 * from needed one to store Zoho OAuth tokens it had to read back, which meant an
 * AES key in the environment. Nothing in this application stores a secret it
 * ever needs to recover: a session token is hashed and compared, and a password
 * is hashed with bcrypt (see src/lib/auth/password.ts). Keeping only hashes means
 * there is no key to leak.
 */

/** Opaque, URL-safe token for session cookies. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** What we persist for a session token — the token itself is never stored. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison for a secret supplied by a caller. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

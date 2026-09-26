import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Authenticated encryption for secrets that must be stored but also read back —
 * currently Zoho OAuth refresh and access tokens.
 *
 * Passwords never go through here: they are one-way hashed with bcrypt
 * (see src/lib/auth/password.ts).
 *
 * Wire format (base64):  [12-byte IV][16-byte GCM tag][ciphertext]
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = "aes-256-gcm";

function key(): Buffer {
  return Buffer.from(serverEnv().APP_ENCRYPTION_KEY, "base64");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted payload is malformed.");
  }

  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** Opaque, URL-safe token for session cookies and OAuth `state`. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** What we persist for a session token — the token itself is never stored. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison for secrets supplied by a caller (e.g. CRON_SECRET). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

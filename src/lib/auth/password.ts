import "server-only";

import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * Password hashing and strength policy.
 *
 * Replaces the legacy portal's `password_verify()` against a hash pasted into
 * config.php: hashes now live in the database, and the policy below is enforced
 * whenever a password is set or changed.
 */

const COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * A dummy hash compared against when the supplied e-mail does not exist, so a
 * failed login costs the same time either way and cannot be used to enumerate
 * accounts.
 */
export const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.aBcDeFgHiJkLmNoPqRsTuVwXyZ012345";

export const passwordPolicy = z
  .string()
  .min(12, "Password must be at least 12 characters long.")
  .max(200, "Password must be at most 200 characters long.")
  .refine((v) => /[a-z]/.test(v), "Password must contain a lowercase letter.")
  .refine((v) => /[A-Z]/.test(v), "Password must contain an uppercase letter.")
  .refine((v) => /[0-9]/.test(v), "Password must contain a digit.")
  .refine(
    (v) => /[^A-Za-z0-9]/.test(v),
    "Password must contain a symbol.",
  );

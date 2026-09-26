import "server-only";

import { z } from "zod";

/**
 * Validated server environment.
 *
 * Parsed lazily so that `next build` can compile pages without a database or
 * Zoho credentials present; anything that actually touches those values calls
 * `serverEnv()` at request time and fails loudly if configuration is missing.
 */

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  /** base64-encoded 32-byte key for AES-256-GCM. Generate with `npm run keygen`. */
  APP_ENCRYPTION_KEY: z
    .string()
    .min(1, "APP_ENCRYPTION_KEY is required")
    .refine(
      (value) => Buffer.from(value, "base64").length === 32,
      "APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    ),

  CRON_SECRET: z.string().min(16).optional(),

  APP_URL: z.string().url().default("http://localhost:3000"),

  ZOHO_CLIENT_ID: z.string().optional(),
  ZOHO_CLIENT_SECRET: z.string().optional(),
  ZOHO_REGION: z
    .enum(["com", "in", "eu", "au", "jp", "ca", "sa"])
    .default("in"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment configuration:\n${issues}\n\n` +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  cached = parsed.data;
  return cached;
}

/** True when the app is served over HTTPS, which gates the `Secure` cookie flag. */
export function isSecureOrigin(): boolean {
  const url = process.env.APP_URL ?? "http://localhost:3000";
  return url.startsWith("https://");
}

/** Zoho accounts/API hosts differ per data centre. */
export function zohoHosts(region: string) {
  const domain = region === "com" ? "com" : region;
  return {
    accounts: `https://accounts.zoho.${domain}`,
    books: `https://www.zohoapis.${domain}/books/v3`,
  };
}

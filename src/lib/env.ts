import "server-only";

import { z } from "zod";

/**
 * Validated server environment.
 *
 * Parsed lazily so that `next build` can compile pages without a database
 * present; anything that actually touches a value calls `serverEnv()` at request
 * time and fails loudly if configuration is missing.
 *
 * Shorter than it was. The portal this was forked from stored Zoho OAuth tokens,
 * so it required an AES key and a cron secret to protect them. Nothing here
 * holds a third-party credential — the register arrives as a spreadsheet an
 * operator uploads — so those variables are gone rather than left unused, which
 * is one fewer secret to rotate and one fewer way to misconfigure a deployment.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  APP_URL: z.string().url().default("http://localhost:3000"),
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

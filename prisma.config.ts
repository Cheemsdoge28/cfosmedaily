import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Connection URLs no longer live in schema.prisma — they are declared here.
 *
 *   DATABASE_URL  pooled connection used by the application at runtime.
 *                 On Neon this is the "-pooler" host, which is what serverless
 *                 functions must use.
 *   DIRECT_URL    unpooled connection used for migrations only. Neon's pooler
 *                 cannot run the DDL that `prisma migrate` issues.
 *
 * Prisma 7 also stopped auto-loading .env files, so we load them here. On
 * Vercel the variables are already in the environment and these calls no-op.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File absent (or already-set variables) — nothing to do.
  }
}

/**
 * The unpooled connection, under whichever name the environment supplies it.
 *
 * Neon's own Vercel integration writes `DATABASE_URL_UNPOOLED` and
 * `POSTGRES_URL_NON_POOLING`; `DIRECT_URL` is this project's documented name.
 * Any of them is the same endpoint, and migrations need one of them — the
 * pooled host cannot run the DDL `prisma migrate` issues. Falling back through
 * the list means a .env pasted straight out of Neon works untouched.
 */
const UNPOOLED_KEYS = [
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

const migrationUrlKey =
  UNPOOLED_KEYS.find((key) => process.env[key]) ?? "DATABASE_URL";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    /**
     * CLI only — `prisma migrate`, `db push`, `studio` and the seed run through
     * this. It deliberately prefers an unpooled URL, and falls back to
     * DATABASE_URL so a single-URL setup still works.
     *
     * The application itself never reads this. At runtime src/lib/db.ts opens
     * the pooled DATABASE_URL through the Postgres driver adapter.
     */
    url: env(migrationUrlKey),
  },
});

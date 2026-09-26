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

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    /**
     * CLI only — `prisma migrate`, `db push`, `studio` and the seed run through
     * this. It deliberately prefers DIRECT_URL: Neon's pooled endpoint cannot
     * run the DDL that migrations issue. It falls back to DATABASE_URL so a
     * single-URL setup still works.
     *
     * The application itself never reads this. At runtime src/lib/db.ts opens
     * the pooled DATABASE_URL through the Postgres driver adapter.
     */
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
});

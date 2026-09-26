import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton.
 *
 * Prisma 7 runs without the Rust query engine, so a driver adapter supplies the
 * connection. `@prisma/adapter-pg` speaks plain PostgreSQL, which works against
 * Neon's pooled (`-pooler`) endpoint as well as any other Postgres instance.
 *
 * The singleton survives hot reloads in development, where each reload would
 * otherwise open a fresh pool and exhaust connections.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Neon database.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // Serverless functions are short-lived; a small pool avoids holding Neon
    // connections open longer than a single invocation needs them.
    max: process.env.NODE_ENV === "production" ? 5 : 10,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

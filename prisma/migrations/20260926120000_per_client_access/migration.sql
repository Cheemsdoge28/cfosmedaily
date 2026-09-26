-- Per-user, per-client access.
--
-- Replaces `User.clientId` plus the CLIENT_ADMIN/VIEWER roles with an explicit
-- grant table. The old shape made "one person, one client" a fact of the schema
-- and made edit rights an account-wide setting; neither is true of how the
-- practice actually works.
--
-- Order matters here: the grants are backfilled from the columns being removed,
-- so the backfill runs before the role enum is narrowed and before the column is
-- dropped. Written by hand rather than generated for exactly that reason — a
-- generated migration would have dropped the column and lost who could see what.

-- ── 1. The level a grant carries ────────────────────────────────────────────
CREATE TYPE "AccessLevel" AS ENUM ('VIEW', 'EDIT');

-- ── 2. The grant table ──────────────────────────────────────────────────────
CREATE TABLE "ClientAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL DEFAULT 'VIEW',
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientAccess_userId_clientId_key" ON "ClientAccess"("userId", "clientId");
CREATE INDEX "ClientAccess_userId_idx" ON "ClientAccess"("userId");
CREATE INDEX "ClientAccess_clientId_idx" ON "ClientAccess"("clientId");

ALTER TABLE "ClientAccess" ADD CONSTRAINT "ClientAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAccess" ADD CONSTRAINT "ClientAccess_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAccess" ADD CONSTRAINT "ClientAccess_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Backfill, before the source columns go ───────────────────────────────
-- Everyone who was bound to a client keeps exactly the access they had:
-- a CLIENT_ADMIN could move tasks, so that becomes EDIT; a VIEWER becomes VIEW.
-- PLATFORM_ADMIN accounts get no rows, because they read every client by role and
-- a grant for each would be redundant and would rot as clients are added.
INSERT INTO "ClientAccess" ("id", "userId", "clientId", "level", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "clientId",
    CASE WHEN "role" = 'CLIENT_ADMIN' THEN 'EDIT'::"AccessLevel" ELSE 'VIEW'::"AccessLevel" END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "clientId" IS NOT NULL
  AND "role" <> 'PLATFORM_ADMIN';

-- ── 4. Narrow the role enum ─────────────────────────────────────────────────
-- Postgres cannot remove a value from an enum, so the type is replaced and the
-- column rewritten through it.
CREATE TYPE "Role_new" AS ENUM ('PLATFORM_ADMIN', 'MEMBER');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
    CASE WHEN "role" = 'PLATFORM_ADMIN' THEN 'PLATFORM_ADMIN' ELSE 'MEMBER' END
)::"Role_new";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- ── 5. Drop the column the grants replace ───────────────────────────────────
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_clientId_fkey";
DROP INDEX IF EXISTS "User_clientId_idx";
ALTER TABLE "User" DROP COLUMN "clientId";

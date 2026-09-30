-- Removing a user is a mark, not a delete.
--
-- Nothing is destroyed: the row stays, and so does every row that references it
-- — audit entries, task history, workbook imports, the grants it held. A hard
-- delete would take "who moved this task to Done in September" with it, and that
-- is the question the register exists to answer.
--
-- A removed account cannot sign in, holds no live sessions, and is filtered out
-- of every listing except the administration screen that can restore it.

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedById" TEXT;

-- Self-referencing: who removed whom. SET NULL rather than CASCADE, so removing
-- the administrator who removed someone does not erase that fact.
ALTER TABLE "User" ADD CONSTRAINT "User_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every listing filters on this.
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

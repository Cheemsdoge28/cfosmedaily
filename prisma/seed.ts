/**
 * Seed.
 *
 * The register as it actually stood: the 88 tasks, 18 clients, 2 owners and 7
 * processes of CFOSME_Task_Tracker.xlsx, lifted from the workbook into
 * `seed-tasks.json` so this runs without needing the file to hand.
 *
 * The rows are stored in the shape the spreadsheet had them — an ISO date where
 * the cell held a real date, the operator's own wording where it did not ("20th
 * Sept ") — and are put through `resolveDueDate` and `reconcile`, the same
 * functions the importer uses. So the seed exercises the real parsing path rather
 * than a tidied copy of it, and two things the workbook contains survive into the
 * demo data honestly:
 *
 *   - 59 of the 88 due dates are text, not dates. They resolve against September
 *     2026, the month the register covers.
 *   - TS0011 is stored as "Done" at 60% progress. `reconcile` demotes it to In
 *     progress, which is what the figures ought to have said all along.
 *
 *   npm run db:seed
 *
 * Re-running is safe: everything is upserted on its natural key.
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import type { Frequency, TaskStatus } from "../src/generated/prisma/enums";
import { resolveDueDate } from "../src/lib/tasks/due-date";
import { reconcile } from "../src/lib/tasks/transition";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not present — rely on the ambient environment.
  }
}

// The same order prisma.config.ts resolves: an unpooled endpoint under any of
// the names Neon and this project use, then the pooled one as a last resort.
const connectionString =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL (or DIRECT_URL) must be set before seeding. See .env.example.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** The month the seeded register covers, which resolves a bare "20th Sept". */
const PERIOD = { year: 2026, month: 9 };

type SeedTask = {
  reference: string;
  client: string;
  process: string;
  activity: string;
  description: string;
  owner: string;
  frequency: string;
  dueRule: string;
  due: string;
  status: string;
  progress: number;
  notes: string;
};

const FREQUENCIES: Record<string, Frequency> = {
  Daily: "DAILY",
  Weekly: "WEEKLY",
  Fortnightly: "FORTNIGHTLY",
  Monthly: "MONTHLY",
  Quarterly: "QUARTERLY",
  "Half-yearly": "HALF_YEARLY",
  Annual: "ANNUAL",
  "Ad hoc": "AD_HOC",
};

const STATUSES: Record<string, TaskStatus> = {
  Done: "DONE",
  "In progress": "IN_PROGRESS",
  "At risk": "AT_RISK",
  Blocked: "BLOCKED",
  "Not started": "NOT_STARTED",
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "client"
  );
}

function strongPassword(): string {
  return `${randomBytes(9).toString("base64url")}#7Aa`;
}

async function main() {
  console.log("Seeding CFOSME Pulse Pro\n");

  const tasks: SeedTask[] = JSON.parse(
    readFileSync(join(import.meta.dirname, "seed-tasks.json"), "utf8"),
  );

  // ── Clients ───────────────────────────────────────────────────────────────
  // Taken from the workbook's Client column, in first-appearance order, exactly
  // as the importer would create them.
  const clientNames = [...new Set(tasks.map((task) => task.client))];
  const clientIds = new Map<string, string>();

  for (const name of clientNames) {
    const client = await prisma.client.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { name, slug: slugify(name) },
      select: { id: true },
    });
    clientIds.set(name, client.id);
  }
  console.log(`  ${clientNames.length} clients`);

  // ── Tasks ─────────────────────────────────────────────────────────────────
  let reconciled = 0;
  let undated = 0;

  for (const task of tasks) {
    const frequency = FREQUENCIES[task.frequency];
    if (!frequency) throw new Error(`Unmapped frequency: ${task.frequency}`);

    const status = STATUSES[task.status];
    if (!status) throw new Error(`Unmapped status: ${task.status}`);

    const state = reconcile({ status, progress: task.progress });
    if (state.status !== status) reconciled += 1;

    // An ISO value in the seed file only ever came from a real Excel date cell —
    // the operator wording is always of the "20th Sept" kind — so it is handed
    // over as a Date. That matters: `dueText` is meant to hold what the workbook
    // said *when the cell was not a date*, and passing the ISO form as a string
    // would set it on all 88 rows instead of the 59 that need it.
    const cell = /^\d{4}-\d{2}-\d{2}$/.test(task.due)
      ? new Date(`${task.due}T00:00:00Z`)
      : task.due;

    const due = resolveDueDate(cell, PERIOD);
    if (!due.date) undated += 1;

    const data = {
      clientId: clientIds.get(task.client)!,
      process: task.process || "Unclassified",
      activity: task.activity || task.process || "Unclassified",
      description: task.description,
      owner: task.owner || "Unassigned",
      frequency,
      dueRule: task.dueRule,
      dueDate: due.date,
      dueText: due.text,
      status: state.status,
      progress: state.progress,
      notes: task.notes,
    };

    await prisma.task.upsert({
      where: { reference: task.reference },
      update: data,
      create: { ...data, reference: task.reference },
    });
  }

  console.log(`  ${tasks.length} tasks`);
  if (reconciled) {
    console.log(
      `    ${reconciled} had a status the progress figure contradicted, and were corrected`,
    );
  }
  console.log(
    `    ${tasks.length - undated} with a resolved due date, ${undated} without`,
  );

  // ── Accounts ──────────────────────────────────────────────────────────────
  //
  // A password is only ever set when the account is created. Re-running the seed
  // deliberately leaves an existing account alone — it may well have had its
  // password changed since — so it must not print one it did not apply. An
  // earlier version of this used `upsert` with an empty `update` and printed a
  // fresh password on every run, which meant the credentials it offered on the
  // second run simply did not work.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@cfosme.test";
  const clientEmail = "finance@benchmark.test";
  const reviewerEmail = "reviewer@cfosme.test";
  const demoClient = clientNames[0]!;

  async function ensureUser(input: {
    email: string;
    name: string;
    role: "PLATFORM_ADMIN" | "MEMBER";
    /** The clients to grant, and at what level. Empty for CFOSME staff. */
    grants?: { clientId: string; level: "VIEW" | "EDIT" }[];
    password: string;
    passwordWasGiven: boolean;
  }): Promise<string> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) return "already exists — password left unchanged";

    await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, 12),
        mustChangePassword: !input.passwordWasGiven,
        // Access is a grant per client, not a column on the account. A platform
        // admin gets none: they read every client through the role.
        access: input.grants?.length
          ? { create: input.grants }
          : undefined,
      },
    });

    return input.passwordWasGiven
      ? "created, with the password from the environment"
      : `created — password: ${input.password}`;
  }

  const adminResult = await ensureUser({
    email: adminEmail,
    name: "CFOSME Administrator",
    role: "PLATFORM_ADMIN",
    password: process.env.SEED_ADMIN_PASSWORD || strongPassword(),
    passwordWasGiven: Boolean(process.env.SEED_ADMIN_PASSWORD),
  });

  // Two member logins, so both halves of the access model can be checked without
  // creating accounts by hand:
  //
  //   one client, editable   what a client's own finance lead sees
  //   two clients, mixed     a CFOSME reviewer who covers a couple of clients and
  //                          is read-only on one of them — the case the old
  //                          one-client-per-account shape could not express
  const clientResult = await ensureUser({
    email: clientEmail,
    name: `${demoClient} Finance`,
    role: "MEMBER",
    grants: [{ clientId: clientIds.get(demoClient)!, level: "EDIT" }],
    password: process.env.SEED_CLIENT_PASSWORD || strongPassword(),
    passwordWasGiven: Boolean(process.env.SEED_CLIENT_PASSWORD),
  });

  const secondClient = clientNames[1] ?? demoClient;
  const reviewerResult = await ensureUser({
    email: reviewerEmail,
    name: "CFOSME Reviewer",
    role: "MEMBER",
    grants: [
      { clientId: clientIds.get(demoClient)!, level: "EDIT" },
      ...(secondClient !== demoClient
        ? [{ clientId: clientIds.get(secondClient)!, level: "VIEW" as const }]
        : []),
    ],
    password: process.env.SEED_REVIEWER_PASSWORD || strongPassword(),
    passwordWasGiven: Boolean(process.env.SEED_REVIEWER_PASSWORD),
  });

  console.log("\n  Accounts");
  console.log(`    CFOSME staff  : ${adminEmail}`);
  console.log(`                    ${adminResult}`);
  console.log(`    client login  : ${clientEmail}  (${demoClient}, can edit)`);
  console.log(`                    ${clientResult}`);
  console.log(
    `    reviewer      : ${reviewerEmail}  (${demoClient} can edit, ${secondClient} view only)`,
  );
  console.log(`                    ${reviewerResult}`);
  console.log(
    "\n    A newly created password is shown once and must be changed at first",
  );
  console.log(
    "    sign-in. To reset one later, use Administration -> Clients & logins.",
  );

  console.log("\nDone.\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

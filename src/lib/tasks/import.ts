import "server-only";

import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { DueContext } from "@/lib/tasks/due-date";
import { differs } from "@/lib/tasks/transition";
import { norm, parseWorkbook, type ParsedRow } from "@/lib/tasks/workbook";

/**
 * Bringing a workbook into the register.
 *
 * The spreadsheet remains where CFOSME keeps the register, so this is the path
 * that matters most: it runs every time the workbook changes, and it has to be
 * safe to run twice. Everything is matched on the workbook's own Task ID, so a
 * re-import updates rather than duplicates, and a task whose Client cell was
 * corrected moves between clients instead of being cloned.
 *
 * What it records, beyond the tasks themselves:
 *
 *   TaskImport  the counts, so an operator can see what an upload did.
 *   TaskEvent   one row per task the import actually moved, with source=IMPORT,
 *               so the history distinguishes a figure that came from the
 *               workbook from one somebody set by hand.
 *
 * Rows that cannot be read do not fail the upload. They are reported per row and
 * the rest is imported — an operator fixing one typo should not have to re-upload
 * eighty-seven good rows.
 */

export type ImportOutcome = {
  importId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  rowsRead: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  clientsCreated: string[];
  errors: string[];
};

/** "Chemtrols Infotech Pvt. Ltd" -> "chemtrols-infotech-pvt-ltd". */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "client";
}

/**
 * Finds the client a row names, creating it if the practice has taken on a new
 * one since the last upload.
 *
 * Matching is case-insensitive on the collapsed name, because the workbook
 * contains "Shailesh Gadre  GKFS" with two spaces — treating that as a
 * nineteenth client is exactly the drift this guards against.
 */
async function resolveClient(
  name: string,
  cache: Map<string, string>,
  created: string[],
): Promise<string> {
  const clean = norm(name);
  const lookup = clean.toLowerCase();

  const cached = cache.get(lookup);
  if (cached) return cached;

  const existing = await prisma.client.findFirst({
    where: { name: { equals: clean, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    cache.set(lookup, existing.id);
    return existing.id;
  }

  // A slug collision is possible where two names differ only in punctuation, so
  // the first free suffix wins rather than the insert failing.
  let slug = slugify(clean);
  for (let attempt = 2; attempt <= 50; attempt += 1) {
    const taken = await prisma.client.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) break;
    slug = `${slugify(clean)}-${attempt}`.slice(0, 40);
  }

  const client = await prisma.client.create({
    data: { name: clean, slug },
    select: { id: true },
  });

  cache.set(lookup, client.id);
  created.push(clean);
  return client.id;
}

function sameAsStored(
  row: ParsedRow,
  stored: {
    clientId: string;
    process: string;
    activity: string;
    description: string;
    owner: string;
    frequency: string;
    dueRule: string;
    dueDate: Date | null;
    dueText: string | null;
    status: string;
    progress: number;
    notes: string;
  },
  clientId: string,
): boolean {
  const sameDue =
    (row.dueDate?.getTime() ?? null) === (stored.dueDate?.getTime() ?? null) &&
    (row.dueText ?? null) === (stored.dueText ?? null);

  return (
    clientId === stored.clientId &&
    row.process === stored.process &&
    row.activity === stored.activity &&
    row.description === stored.description &&
    row.owner === stored.owner &&
    row.frequency === stored.frequency &&
    row.dueRule === stored.dueRule &&
    sameDue &&
    row.status === stored.status &&
    row.progress === stored.progress &&
    row.notes === stored.notes
  );
}

export async function importWorkbook(input: {
  buffer: ArrayBuffer | Buffer;
  fileName: string;
  userId: string;
  /** Fixes the month a bare "20th" in the Due Date column belongs to. */
  context: DueContext;
}): Promise<ImportOutcome> {
  const record = await prisma.taskImport.create({
    data: { userId: input.userId, fileName: input.fileName },
    select: { id: true },
  });

  await recordAudit({
    action: "import.start",
    userId: input.userId,
    detail: `${input.fileName} (period ${input.context.year}-${String(input.context.month).padStart(2, "0")})`,
  });

  const finish = async (
    outcome: Omit<ImportOutcome, "importId">,
  ): Promise<ImportOutcome> => {
    await prisma.taskImport.update({
      where: { id: record.id },
      data: {
        status: outcome.status,
        rowsRead: outcome.rowsRead,
        created: outcome.created,
        updated: outcome.updated,
        unchanged: outcome.unchanged,
        skipped: outcome.skipped,
        // A hundred bad rows would be a hundred rows of audit detail; the page
        // shows the first twenty and says how many more there were.
        errors: outcome.errors.slice(0, 20),
        finishedAt: new Date(),
      },
    });

    await recordAudit({
      action: outcome.status === "FAILED" ? "import.failure" : "import.success",
      userId: input.userId,
      detail:
        outcome.status === "FAILED"
          ? `${input.fileName}: ${outcome.errors[0] ?? "failed"}`
          : `${input.fileName}: ${outcome.created} created, ${outcome.updated} updated, ${outcome.skipped} skipped`,
    });

    return { importId: record.id, ...outcome };
  };

  let parsed;
  try {
    parsed = await parseWorkbook(input.buffer, input.context);
  } catch (error) {
    // A file-level problem — wrong workbook, missing sheet, missing columns.
    return finish({
      status: "FAILED",
      rowsRead: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      clientsCreated: [],
      errors: [error instanceof Error ? error.message : "The file could not be read."],
    });
  }

  if (parsed.rows.length === 0) {
    return finish({
      status: "FAILED",
      rowsRead: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: parsed.errors.length,
      clientsCreated: [],
      errors: parsed.errors.length
        ? parsed.errors
        : ["The Tasks sheet holds no task rows."],
    });
  }

  const clientCache = new Map<string, string>();
  const clientsCreated: string[] = [];
  const errors = [...parsed.errors];

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const row of parsed.rows) {
    try {
      const clientId = await resolveClient(row.clientName, clientCache, clientsCreated);

      const stored = await prisma.task.findUnique({
        where: { reference: row.reference },
      });

      const data = {
        clientId,
        process: row.process,
        activity: row.activity,
        description: row.description,
        owner: row.owner,
        frequency: row.frequency,
        dueRule: row.dueRule,
        dueDate: row.dueDate,
        dueText: row.dueText,
        status: row.status,
        progress: row.progress,
        notes: row.notes,
      };

      if (!stored) {
        const task = await prisma.task.create({
          data: { ...data, reference: row.reference },
          select: { id: true },
        });
        await prisma.taskEvent.create({
          data: {
            taskId: task.id,
            userId: input.userId,
            toStatus: row.status,
            toProgress: row.progress,
            source: "IMPORT",
            note: `Created from ${input.fileName}`,
          },
        });
        created += 1;
        continue;
      }

      if (sameAsStored(row, stored, clientId)) {
        unchanged += 1;
        continue;
      }

      const moved = differs(
        { status: stored.status, progress: stored.progress },
        { status: row.status, progress: row.progress },
      );

      await prisma.task.update({
        where: { id: stored.id },
        data: {
          ...data,
          // Only a real move updates who touched it last; correcting a
          // description should not claim the status was revisited.
          ...(moved
            ? { updatedById: input.userId, statusChangedAt: new Date() }
            : {}),
        },
      });

      if (moved) {
        await prisma.taskEvent.create({
          data: {
            taskId: stored.id,
            userId: input.userId,
            fromStatus: stored.status,
            toStatus: row.status,
            fromProgress: stored.progress,
            toProgress: row.progress,
            source: "IMPORT",
            note: input.fileName,
          },
        });
      }

      updated += 1;
    } catch (error) {
      errors.push(
        `Row ${row.rowNumber} (${row.reference}): ${
          error instanceof Error ? error.message : "could not be saved."
        }`,
      );
    }
  }

  const skipped = errors.length;

  return finish({
    status: skipped === 0 ? "SUCCESS" : "PARTIAL",
    rowsRead: parsed.rows.length + parsed.errors.length,
    created,
    updated,
    unchanged,
    skipped,
    clientsCreated,
    errors,
  });
}

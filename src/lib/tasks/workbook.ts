import "server-only";

import ExcelJS from "exceljs";

import type { Frequency, TaskStatus } from "@/generated/prisma/enums";
import { resolveDueDate, type DueContext } from "@/lib/tasks/due-date";
import { reconcile } from "@/lib/tasks/transition";

/**
 * Reading and writing CFOSME_Task_Tracker.xlsx.
 *
 * The workbook stays the practice's working copy, so this has to be a faithful
 * round trip: the export writes the same fourteen columns in the same order the
 * register has always used, and re-importing what was just exported is a no-op.
 *
 * Parsing is strict about the things a wrong answer would hide — a row with no
 * Task ID, a frequency nobody recognises — and reports them per row rather than
 * failing the whole upload. An operator who pastes in two new tasks and fumbles
 * one frequency should get the other one imported and be told precisely which
 * cell to fix.
 *
 * ExcelJS rather than SheetJS: this parses a file someone uploaded, in a server
 * process, and the SheetJS build published to npm has known unpatched advisories
 * for exactly that path.
 */

export const SHEET_NAME = "Tasks";

/** The fourteen columns, in the register's own order. */
export const COLUMNS = [
  "Task ID",
  "Client",
  "Process",
  "Activity",
  "Description",
  "Owner",
  "Frequency",
  "Due Date Rule",
  "Due Date",
  "Status",
  "Progress %",
  "Notes",
  "Last Updated By",
  "Last Updated",
] as const;

/**
 * Spellings seen in the register, and the ones an operator is likely to type.
 * Matching is done on the value lowercased with all non-letters stripped, so
 * "Half Yearly", "half-yearly" and "HalfYearly" are one key.
 */
const FREQUENCIES: Record<string, Frequency> = {
  daily: "DAILY",
  everyday: "DAILY",
  weekly: "WEEKLY",
  fortnightly: "FORTNIGHTLY",
  biweekly: "FORTNIGHTLY",
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  halfyearly: "HALF_YEARLY",
  semiannual: "HALF_YEARLY",
  annual: "ANNUAL",
  annually: "ANNUAL",
  yearly: "ANNUAL",
  adhoc: "AD_HOC",
  asrequired: "AD_HOC",
  onetime: "AD_HOC",
};

const STATUSES: Record<string, TaskStatus> = {
  done: "DONE",
  complete: "DONE",
  completed: "DONE",
  inprogress: "IN_PROGRESS",
  wip: "IN_PROGRESS",
  ongoing: "IN_PROGRESS",
  atrisk: "AT_RISK",
  risk: "AT_RISK",
  blocked: "BLOCKED",
  onhold: "BLOCKED",
  notstarted: "NOT_STARTED",
  pending: "NOT_STARTED",
  yettostart: "NOT_STARTED",
};

function key(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Collapses runs of whitespace — the workbook is full of trailing spaces. */
export function norm(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * An Excel cell can be a string, a number, a date, a formula result or rich
 * text. Everything downstream wants the text a human would see.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return norm(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return norm(value.text);
    if ("result" in value) return norm(value.result as unknown);
    if ("richText" in value && Array.isArray(value.richText)) {
      return norm(value.richText.map((part) => part.text).join(""));
    }
    if ("hyperlink" in value && "text" in value) return norm(value.text);
  }
  return "";
}

/** One row as the importer understands it, or the reason it could not. */
export type ParsedRow = {
  rowNumber: number;
  reference: string;
  clientName: string;
  process: string;
  activity: string;
  description: string;
  owner: string;
  frequency: Frequency;
  dueRule: string;
  dueDate: Date | null;
  dueText: string | null;
  status: TaskStatus;
  progress: number;
  notes: string;
};

export type ParseResult = {
  rows: ParsedRow[];
  /** One sentence per unusable row, naming the row and the cell. */
  errors: string[];
  /** Rows that were read but held nothing — trailing blanks in the sheet. */
  blank: number;
};

/**
 * Parses the Tasks sheet.
 *
 * `context` fixes the month a bare day in the Due Date column belongs to. It is
 * passed in rather than read from the clock so that importing the same file
 * twice, in different months, produces the same dates.
 */
export async function parseWorkbook(
  buffer: ArrayBuffer | Buffer,
  context: DueContext,
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS reads a byte view, but types the parameter as the `Buffer` of an
  // older @types/node, where it was not yet generic over its backing store. The
  // cast is to the loader's own parameter type rather than to `Buffer`, so it
  // stays correct if ExcelJS ever widens it.
  const bytes = new Uint8Array(
    buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
  type LoadInput = Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(bytes as unknown as LoadInput);

  const sheet =
    workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0] ?? null;
  if (!sheet) throw new Error("The file contains no worksheets.");

  // The header is usually row 1, but the register has carried a title block
  // above it before now, so find it rather than assume.
  let headerRow = 0;
  for (let r = 1; r <= Math.min(sheet.rowCount, 20); r += 1) {
    const values = sheet.getRow(r).values;
    if (Array.isArray(values) && values.some((v) => key(cellText(v)) === "taskid")) {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) {
    throw new Error(
      'Could not find the header row — no cell in the first 20 rows reads "Task ID".',
    );
  }

  // Map column name -> column index, so a reordered or extra column is fine.
  const index = new Map<string, number>();
  const header = sheet.getRow(headerRow);
  header.eachCell((cell, column) => {
    const name = key(cellText(cell.value));
    if (name && !index.has(name)) index.set(name, column);
  });

  const required = ["taskid", "client", "owner", "frequency"];
  const missing = required.filter((name) => !index.has(name));
  if (missing.length) {
    const labels: Record<string, string> = {
      taskid: "Task ID",
      client: "Client",
      owner: "Owner",
      frequency: "Frequency",
    };
    throw new Error(
      `The Tasks sheet is missing these columns: ${missing.map((m) => labels[m]).join(", ")}.`,
    );
  }

  const at = (row: ExcelJS.Row, name: string): ExcelJS.CellValue => {
    const column = index.get(name);
    return column ? row.getCell(column).value : null;
  };
  const text = (row: ExcelJS.Row, name: string): string => cellText(at(row, name));

  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();
  let blank = 0;

  for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);

    const reference = text(row, "taskid");
    const clientName = text(row, "client");
    const owner = text(row, "owner");
    const frequencyRaw = text(row, "frequency");

    // Entirely empty rows are the normal tail of a spreadsheet, not an error.
    if (!reference && !clientName && !owner && !frequencyRaw) {
      blank += 1;
      continue;
    }

    if (!reference) {
      errors.push(`Row ${r}: no Task ID, so there is nothing to match it on.`);
      continue;
    }
    if (!clientName) {
      errors.push(`Row ${r} (${reference}): no Client.`);
      continue;
    }

    const duplicate = seen.get(reference);
    if (duplicate) {
      errors.push(
        `Row ${r}: Task ID ${reference} already appears on row ${duplicate}. Only the first was imported.`,
      );
      continue;
    }

    const frequency = FREQUENCIES[key(frequencyRaw)];
    if (!frequency) {
      errors.push(
        frequencyRaw
          ? `Row ${r} (${reference}): "${frequencyRaw}" is not a frequency this register knows.`
          : `Row ${r} (${reference}): no Frequency.`,
      );
      continue;
    }

    const statusRaw = text(row, "status");
    // An empty Status is the normal state of a newly added row, so it defaults
    // rather than failing. A status that was *typed* and not recognised is a
    // typo worth reporting, because defaulting it would hide the mistake.
    let status: TaskStatus = "NOT_STARTED";
    if (statusRaw) {
      const mapped = STATUSES[key(statusRaw)];
      if (!mapped) {
        errors.push(
          `Row ${r} (${reference}): "${statusRaw}" is not a status this register knows.`,
        );
        continue;
      }
      status = mapped;
    }

    const progressRaw = at(row, "progress");
    const progressNumber =
      typeof progressRaw === "number" ? progressRaw : Number(cellText(progressRaw));
    // A blank cell is 0%, but text that is not a number is a mistake.
    if (cellText(progressRaw) && !Number.isFinite(progressNumber)) {
      errors.push(
        `Row ${r} (${reference}): Progress % reads "${cellText(progressRaw)}", which is not a number.`,
      );
      continue;
    }
    // Excel percentage-formatted cells hold 0.6 for 60%.
    const scaled =
      Number.isFinite(progressNumber) && progressNumber > 0 && progressNumber <= 1
        ? progressNumber * 100
        : progressNumber;

    const state = reconcile({
      status,
      progress: Number.isFinite(scaled) ? scaled : 0,
    });

    const due = resolveDueDate(at(row, "duedate"), context);

    seen.set(reference, r);
    rows.push({
      rowNumber: r,
      reference,
      clientName,
      process: text(row, "process") || "Unclassified",
      activity: text(row, "activity") || text(row, "process") || "Unclassified",
      description: text(row, "description"),
      owner: owner || "Unassigned",
      frequency,
      dueRule: text(row, "duedaterule"),
      dueDate: due.date,
      dueText: due.text,
      status: state.status,
      progress: state.progress,
      notes: text(row, "notes"),
    });
  }

  return { rows, errors, blank };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export type ExportRow = {
  reference: string;
  clientName: string;
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
  updatedByName: string | null;
  updatedAt: Date | null;
};

/**
 * Writes the register back out as a workbook.
 *
 * Deliberately the same fourteen columns in the same order, with the enums
 * turned back into the words the practice uses, so the file can go straight back
 * into the folder it came from. A task whose due date never resolved exports the
 * original wording rather than an empty cell — losing what the operator typed
 * would make the round trip destructive.
 */
export async function buildWorkbook(rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CFOSME Pulse Pro";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: COLUMNS[0], key: "reference", width: 10 },
    { header: COLUMNS[1], key: "clientName", width: 28 },
    { header: COLUMNS[2], key: "process", width: 30 },
    { header: COLUMNS[3], key: "activity", width: 26 },
    { header: COLUMNS[4], key: "description", width: 52 },
    { header: COLUMNS[5], key: "owner", width: 18 },
    { header: COLUMNS[6], key: "frequency", width: 13 },
    { header: COLUMNS[7], key: "dueRule", width: 26 },
    { header: COLUMNS[8], key: "dueDate", width: 14 },
    { header: COLUMNS[9], key: "status", width: 13 },
    { header: COLUMNS[10], key: "progress", width: 11 },
    { header: COLUMNS[11], key: "notes", width: 34 },
    { header: COLUMNS[12], key: "updatedByName", width: 20 },
    { header: COLUMNS[13], key: "updatedAt", width: 18 },
  ];

  const head = sheet.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow({
      ...row,
      // The resolved date where there is one; otherwise exactly what the
      // workbook said, so nothing an operator typed is thrown away.
      dueDate: row.dueDate ?? row.dueText ?? "",
      updatedByName: row.updatedByName ?? "",
      updatedAt: row.updatedAt ?? "",
    });
  }

  sheet.getColumn("dueDate").numFmt = "dd-mmm-yyyy";
  sheet.getColumn("updatedAt").numFmt = "dd-mmm-yyyy hh:mm";
  sheet.getColumn("progress").alignment = { horizontal: "right" };
  sheet.autoFilter = { from: "A1", to: { row: 1, column: COLUMNS.length } };

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

/**
 * Checks a workbook against the importer, and the export against the importer.
 *
 * Reports what parsed, what resolved, what could not be read, and then proves the
 * round trip: the register is written back out and re-read, and every field of
 * every row must come back identical. That is the property the practice relies on
 * when it downloads the register, edits it and uploads it again.
 *
 *   npm run check:workbook -- ~/Downloads/CFOSME_Task_Tracker.xlsx 2026-09
 *
 * Needs no database.
 */

import { readFileSync } from "node:fs";

import { buildWorkbook, parseWorkbook } from "../src/lib/tasks/workbook";
import { frequencyLabel, statusLabel } from "../src/lib/tasks/format";
import { daysUntil } from "../src/lib/tasks/due-date";

const FILE = process.argv[2];
if (!FILE) {
  console.error(
    "usage: npm run check:workbook -- <path to CFOSME_Task_Tracker.xlsx> [YYYY-MM]",
  );
  process.exit(2);
}

// The month a bare "20th" belongs to, as the import screen asks for.
const period = process.argv[3] ?? "2026-09";
const [py, pm] = period.split("-").map(Number);
const PERIOD = { year: py!, month: pm! };

async function main() {
  const buf = readFileSync(FILE);
  const parsed = await parseWorkbook(buf, PERIOD);

  console.log("=== PARSE ===");
  console.log("rows parsed :", parsed.rows.length);
  console.log("errors      :", parsed.errors.length, parsed.errors.slice(0, 5));
  console.log("blank rows  :", parsed.blank);

  const resolved = parsed.rows.filter((r) => r.dueDate).length;
  const kept = parsed.rows.filter((r) => r.dueText).length;
  console.log("due resolved:", resolved, "/", parsed.rows.length);
  console.log("raw text kept on:", kept);
  console.log("unresolved  :", parsed.rows.filter((r) => !r.dueDate).map((r) => `${r.reference}="${r.dueText}"`));

  // Every text form that resolved, to eyeball the mapping.
  const textResolved = parsed.rows.filter((r) => r.dueDate && r.dueText);
  console.log("\nsample text->date:");
  for (const r of textResolved.slice(0, 6)) {
    console.log(`  "${r.dueText}" -> ${r.dueDate!.toISOString().slice(0, 10)}`);
  }

  // The reconciliation the old dashboard got wrong.
  console.log("\nTS0011 (stored Done at 60% in the workbook):");
  const ts11 = parsed.rows.find((r) => r.reference === "TS0011")!;
  console.log(`  -> ${statusLabel(ts11.status)} at ${ts11.progress}%`);

  console.log("\nstatuses  :", [...new Set(parsed.rows.map((r) => statusLabel(r.status)))].join(", "));
  console.log("frequencies:", [...new Set(parsed.rows.map((r) => frequencyLabel(r.frequency)))].join(", "));
  console.log("clients   :", new Set(parsed.rows.map((r) => r.clientName)).size);

  // Overdue, as the dashboard would count it on a date inside the period.
  const asOf = new Date("2026-09-26T00:00:00Z");
  const overdue = parsed.rows.filter(
    (r) => r.status !== "DONE" && r.dueDate && (daysUntil(r.dueDate, asOf) ?? 0) < 0,
  );
  console.log(`\noverdue as at 2026-09-26: ${overdue.length}`);

  // ── Round trip ───────────────────────────────────────────────────────────
  console.log("\n=== ROUND TRIP ===");
  const out = await buildWorkbook(
    parsed.rows.map((r) => ({
      reference: r.reference,
      clientName: r.clientName,
      process: r.process,
      activity: r.activity,
      description: r.description,
      owner: r.owner,
      frequency: frequencyLabel(r.frequency),
      dueRule: r.dueRule,
      dueDate: r.dueDate,
      dueText: r.dueText,
      status: statusLabel(r.status),
      progress: r.progress,
      notes: r.notes,
      updatedByName: "Verification",
      updatedAt: new Date("2026-09-26T09:30:00Z"),
    })),
  );
  console.log("exported bytes:", out.byteLength);

  const again = await parseWorkbook(out, PERIOD);
  console.log("re-parsed rows:", again.rows.length, "errors:", again.errors.length, again.errors.slice(0, 3));

  // The re-import must be byte-for-byte equivalent on every field that matters.
  let drift = 0;
  for (const before of parsed.rows) {
    const after = again.rows.find((r) => r.reference === before.reference);
    if (!after) {
      console.log("  MISSING after round trip:", before.reference);
      drift++;
      continue;
    }
    const fields: (keyof typeof before)[] = [
      "clientName", "process", "activity", "description", "owner",
      "frequency", "dueRule", "status", "progress", "notes",
    ];
    for (const f of fields) {
      if (String(before[f]) !== String(after[f])) {
        console.log(`  DRIFT ${before.reference}.${f}: "${before[f]}" -> "${after[f]}"`);
        drift++;
      }
    }
    const b = before.dueDate?.toISOString().slice(0, 10) ?? null;
    const a = after.dueDate?.toISOString().slice(0, 10) ?? null;
    if (b !== a) {
      console.log(`  DRIFT ${before.reference}.dueDate: ${b} -> ${a}`);
      drift++;
    }
  }
  console.log(drift === 0 ? "round trip is lossless on every field" : `${drift} field(s) drifted`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exitCode = 1;
});

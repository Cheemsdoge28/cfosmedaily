/**
 * The register's rules, checked.
 *
 * Every case here is one the workbook actually contains or that an operator can
 * type: the Done-at-60% row, the "20th Sept " cells with no year, the Excel date
 * that arrives at UTC midnight. No database and no fixture file — it runs
 * anywhere, in about a second.
 *
 *   npm run check
 */

import { resolveDueDate, daysUntil } from "../src/lib/tasks/due-date";
import { applyProgress, applyStatus, reconcile } from "../src/lib/tasks/transition";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { console.log(`  FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); fail++; }
  else console.log(`  ok   ${label}`);
};
const P = { year: 2026, month: 9 };
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

console.log("due dates");
eq('Excel date cell at UTC midnight', iso(resolveDueDate(new Date("2026-09-08T00:00:00.000Z"), P).date), "2026-09-08");
eq('same cell keeps no text', resolveDueDate(new Date("2026-09-08T00:00:00.000Z"), P).text, null);
eq('"20th Sept "', iso(resolveDueDate("20th Sept ", P).date), "2026-09-20");
eq('"3rd Sept"', iso(resolveDueDate("3rd Sept", P).date), "2026-09-03");
eq('"Sept 20"', iso(resolveDueDate("Sept 20", P).date), "2026-09-20");
eq('"3 September 2027"', iso(resolveDueDate("3 September 2027", P).date), "2027-09-03");
eq('bare "20th" -> register month', iso(resolveDueDate("20th", P).date), "2026-09-20");
eq('day-first "08/09/2026"', iso(resolveDueDate("08/09/2026", P).date), "2026-09-08");
eq('two-digit year "8-9-26"', iso(resolveDueDate("8-9-26", P).date), "2026-09-08");
eq('31 February is rejected', resolveDueDate("31 Feb", P).date, null);
eq('unreadable text kept verbatim', resolveDueDate("Monthly after compliance cycle", P), { date: null, text: "Monthly after compliance cycle" });
eq('blank', resolveDueDate("", P), { date: null, text: null });
eq('whitespace collapsed in kept text', resolveDueDate("Per   audit  calendar", P).text, "Per audit calendar");

console.log("days until");
const today = new Date("2026-09-26T00:00:00Z");
eq('same day', daysUntil("2026-09-26", today), 0);
eq('overdue by 6', daysUntil("2026-09-20", today), -6);
eq('4 ahead', daysUntil("2026-09-30", today), 4);
eq('null date', daysUntil(null, today), null);

console.log("status / progress coupling");
eq('workbook Done@60 -> In progress', reconcile({ status: "DONE", progress: 60 }), { status: "IN_PROGRESS", progress: 60 });
eq('Done@0 -> Not started', reconcile({ status: "DONE", progress: 0 }), { status: "NOT_STARTED", progress: 0 });
eq('100% forces Done', reconcile({ status: "BLOCKED", progress: 100 }), { status: "DONE", progress: 100 });
eq('progress clamped high', reconcile({ status: "IN_PROGRESS", progress: 140 }), { status: "DONE", progress: 100 });
eq('progress clamped low', reconcile({ status: "IN_PROGRESS", progress: -20 }), { status: "IN_PROGRESS", progress: 0 });
eq('picking Done sets 100', applyStatus({ status: "AT_RISK", progress: 30 }, "DONE"), { status: "DONE", progress: 100 });
eq('leaving Done resets progress', applyStatus({ status: "DONE", progress: 100 }, "AT_RISK"), { status: "AT_RISK", progress: 0 });
eq('Blocked keeps its progress', applyStatus({ status: "IN_PROGRESS", progress: 40 }, "BLOCKED"), { status: "BLOCKED", progress: 40 });
eq('dragging to 100 finishes it', applyProgress({ status: "AT_RISK", progress: 30 }, 100), { status: "DONE", progress: 100 });
eq('dragging a Done task back', applyProgress({ status: "DONE", progress: 100 }, 45), { status: "IN_PROGRESS", progress: 45 });
eq('dragging a Done task to 0', applyProgress({ status: "DONE", progress: 100 }, 0), { status: "NOT_STARTED", progress: 0 });
eq('a blocked task at 40 stays blocked', applyProgress({ status: "BLOCKED", progress: 20 }, 40), { status: "BLOCKED", progress: 40 });

console.log(fail === 0 ? "\nall logic checks pass" : `\n${fail} failing`);
if (fail) process.exitCode = 1;

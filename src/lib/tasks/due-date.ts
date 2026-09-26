/**
 * Reading a due date out of a spreadsheet cell.
 *
 * The workbook's "Due Date" column is not one type. Of the 88 rows in the
 * register this was built from, 29 hold real Excel dates and 59 hold text an
 * operator typed — "20th Sept ", "3rd Sept", "8th Sept ". The dashboard this
 * replaces parsed only the first kind and reported the other 59 as "no
 * recognised due date", which meant its Overdue figure was counting a third of
 * the register and quietly ignoring the rest.
 *
 * So the text forms are resolved here. What this deliberately does NOT do is
 * guess: a cell it cannot read is returned as unresolved and shown as such,
 * because a made-up deadline is worse than a visibly missing one.
 *
 * Recognised, case- and space-insensitively:
 *
 *   a real Date                     (Excel date cell)
 *   2026-09-08                      ISO
 *   08/09/2026, 8-9-2026            day first, as the practice writes them
 *   20th Sept, 3 September, Sep 20  ordinal or bare day with a month name
 *   20th                            day alone — resolved in the fallback month
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export type DueDateResolution = {
  /** The resolved date at UTC midnight, or null when unreadable. */
  date: Date | null;
  /** The cell's wording, kept whenever it was not already a date. */
  text: string | null;
};

/**
 * The month a bare "20th" belongs to.
 *
 * A register is worked month by month, so a day with no month means the month
 * the register is for. The caller supplies it — the importer passes the period
 * it was told to import — and it is never inferred from today's date, which
 * would make the same file import differently in October than in September.
 */
export type DueContext = {
  /** 1-12. */
  month: number;
  year: number;
};

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects 31 February and friends: the Date constructor rolls them over, so
  // a mismatch after construction means the input was not a real date.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Normalises a two-digit year the way a spreadsheet does: within 50 years
 * forward of 2000. "26" is 2026, not 1926.
 */
function expandYear(value: number): number {
  if (value >= 100) return value;
  return value <= 69 ? 2000 + value : 1900 + value;
}

export function resolveDueDate(
  value: unknown,
  context: DueContext,
): DueDateResolution {
  if (value == null || value === "") return { date: null, text: null };

  // An Excel date cell arrives already parsed.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { date: null, text: null };
    // Excel dates come through at local midnight; re-anchor to UTC midnight so
    // a timezone west of Greenwich cannot shift every deadline back a day.
    const date = utcDate(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
    return { date, text: null };
  }

  const raw = String(value).trim();
  if (!raw) return { date: null, text: null };

  const text = raw.replace(/\s+/g, " ");
  const lower = text.toLowerCase();

  // ISO, and the leading date of an ISO timestamp.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(lower);
  if (iso) {
    const date = utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return { date, text };
  }

  // Day-first numeric: 08/09/2026, 8-9-26, 8.9.2026.
  const numeric = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(lower);
  if (numeric) {
    const date = utcDate(
      expandYear(Number(numeric[3])),
      Number(numeric[2]),
      Number(numeric[1]),
    );
    if (date) return { date, text };
  }

  // "20th Sept", "3 September 2026", with an optional ordinal suffix.
  const dayMonth =
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:\s+(\d{2,4}))?$/.exec(lower);
  if (dayMonth) {
    const month = MONTHS[dayMonth[2]!];
    if (month) {
      const year = dayMonth[3] ? expandYear(Number(dayMonth[3])) : context.year;
      const date = utcDate(year, month, Number(dayMonth[1]));
      if (date) return { date, text };
    }
  }

  // "Sept 20", "September 3rd 2026" — the same thing the other way round.
  const monthDay =
    /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{2,4}))?$/.exec(lower);
  if (monthDay) {
    const month = MONTHS[monthDay[1]!];
    if (month) {
      const year = monthDay[3] ? expandYear(Number(monthDay[3])) : context.year;
      const date = utcDate(year, month, Number(monthDay[2]));
      if (date) return { date, text };
    }
  }

  // A bare day, which belongs to the register's own month.
  const dayOnly = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(lower);
  if (dayOnly) {
    const date = utcDate(context.year, context.month, Number(dayOnly[1]));
    if (date) return { date, text };
  }

  // Unreadable — "Monthly after compliance cycle", "As per audit calendar".
  // Kept verbatim so the register shows what the workbook said.
  return { date: null, text };
}

/** Whole days from today to `due`, in UTC. Negative when the date has passed. */
export function daysUntil(due: Date | string | null, today = new Date()): number | null {
  if (!due) return null;
  const target = typeof due === "string" ? new Date(`${due.slice(0, 10)}T00:00:00Z`) : due;
  if (Number.isNaN(target.getTime())) return null;

  const from = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const to = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  return Math.round((to - from) / 86_400_000);
}

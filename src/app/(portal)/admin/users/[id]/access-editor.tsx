"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Feedback, Input } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { setClientAccessAction } from "@/lib/admin/access-actions";
import { accessLevelLabel } from "@/lib/admin/labels";
import { formatDateTime } from "@/lib/tasks/format";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/types";

/**
 * The access editor.
 *
 * Every client on one screen, set as many as you like, save once.
 *
 * What it replaces is the reason it exists. Access used to be four separate
 * forms — grant one client, change one level, remove one client, grant them all
 * — and each was its own submit and its own page re-render. Putting a reviewer
 * on six clients was six round trips, and because the "grant a client" picker
 * reset after each one, you re-chose your place in an eighteen-item dropdown
 * every time. The work was one decision; the interface made it six.
 *
 * So: one list holding both the clients they have and the ones they do not, a
 * level on each row, checkboxes for setting several at once, and a single Save.
 * Nothing is written until you save, and the footer says exactly how many rows
 * will change — so the screen is safe to explore.
 *
 * It degrades honestly. Every row is a real `<select name="access:<id>">` inside
 * one real form, so without JavaScript you can still change levels and press
 * Save; the search, the checkboxes and the change count are the enhancement.
 */

export type AccessRow = {
  clientId: string;
  clientName: string;
  /** NONE means the account holds no grant for this client. */
  level: "NONE" | "VIEW" | "EDIT";
  clientIsActive: boolean;
  grantedByName: string | null;
  grantedAt: string | null;
};

type Level = AccessRow["level"];
type Filter = "all" | "granted" | "none";

const LEVELS: { value: Level; label: string; short: string }[] = [
  { value: "NONE", label: "No access", short: "None" },
  { value: "VIEW", label: "View only", short: "View" },
  { value: "EDIT", label: "Can edit", short: "Edit" },
];

export function AccessEditor({
  userId,
  rows,
}: {
  userId: string;
  rows: AccessRow[];
}) {
  const [state, action] = useActionState(
    setClientAccessAction,
    INITIAL_ADMIN_STATE,
  );

  // The saved state, keyed by client. `levels` is what the form will submit.
  const initial = useMemo(
    () => new Map(rows.map((row) => [row.clientId, row.level])),
    [rows],
  );

  const [levels, setLevels] = useState<Map<string, Level>>(() => new Map(initial));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // A save revalidates the page, which gives this component new `rows`; keying
  // the reset off that identity is what drops the dirty marks once they are
  // stored, without an effect.
  const [syncedTo, setSyncedTo] = useState(initial);
  if (syncedTo !== initial) {
    setSyncedTo(initial);
    setLevels(new Map(initial));
    setSelected(new Set());
  }

  const changed = useMemo(() => {
    const out: string[] = [];
    for (const [clientId, level] of levels) {
      if (initial.get(clientId) !== level) out.push(clientId);
    }
    return out;
  }, [levels, initial]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const level = levels.get(row.clientId) ?? "NONE";
      if (filter === "granted" && level === "NONE") return false;
      if (filter === "none" && level !== "NONE") return false;
      if (!needle) return true;
      return row.clientName.toLowerCase().includes(needle);
    });
  }, [rows, levels, query, filter, ]);

  const grantedCount = [...levels.values()].filter((l) => l !== "NONE").length;

  function setLevel(clientId: string, level: Level) {
    setLevels((prev) => {
      const next = new Map(prev);
      next.set(clientId, level);
      return next;
    });
  }

  /** Applies one level to every checked row — the whole point of the checkboxes. */
  function setSelectedTo(level: Level) {
    setLevels((prev) => {
      const next = new Map(prev);
      for (const clientId of selected) next.set(clientId, level);
      return next;
    });
    setSelected(new Set());
  }

  function toggle(clientId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  const visibleIds = visible.map((row) => row.clientId);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) for (const id of visibleIds) next.delete(id);
      else for (const id of visibleIds) next.add(id);
      return next;
    });
  }

  function discard() {
    setLevels(new Map(initial));
    setSelected(new Set());
  }

  if (rows.length === 0) {
    return (
      <p className="p-5 text-sm text-muted-foreground">
        There are no active clients to grant yet.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="space-y-3 border-b border-border p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients…"
            aria-label="Search clients"
            className="min-w-0 flex-1"
          />
          <Segmented
            ariaLabel="Show"
            value={filter}
            onValueChange={setFilter}
            className="shrink-0"
            options={[
              { value: "all", label: "All", hint: rows.length },
              { value: "granted", label: "Granted", hint: grantedCount },
              { value: "none", label: "Not granted", hint: rows.length - grantedCount },
            ]}
          />
        </div>

        {/* The bulk bar appears only with a selection, so it never sits there
            as a row of buttons that do nothing. */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2">
            <span className="text-xs font-medium text-foreground">
              {selected.size} selected — set to
            </span>
            {LEVELS.map((level) => (
              <Button
                key={level.value}
                type="button"
                variant="outline"
                onClick={() => setSelectedTo(level.value)}
                className="h-8 px-2.5 text-xs"
              >
                {level.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              className="ms-auto h-8 px-2 text-xs text-muted-foreground"
            >
              Clear selection
            </Button>
          </div>
        )}
      </div>

      {/* ── The list ────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No clients match {query ? `"${query}"` : "that filter"}.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-border px-5 py-2">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              aria-label="Select all shown clients"
              className="size-4 accent-[var(--primary)]"
            />
            <span className="text-xs text-muted-foreground">
              Select all {visible.length} shown
            </span>
          </div>

          <ul>
            {visible.map((row) => {
              const level = levels.get(row.clientId) ?? "NONE";
              const isDirty = initial.get(row.clientId) !== level;

              return (
                <li
                  key={row.clientId}
                  className={cn(
                    "flex items-center gap-3 border-b border-border/60 px-5 py-2.5 last:border-b-0",
                    isDirty && "bg-[var(--tone-warn-bg)]/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.clientId)}
                    onChange={() => toggle(row.clientId)}
                    aria-label={`Select ${row.clientName}`}
                    className="size-4 shrink-0 accent-[var(--primary)]"
                  />

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {row.clientName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {!row.clientIsActive
                        ? "Client suspended — this grant is dormant"
                        : isDirty
                          ? `${accessLevelOrNone(initial.get(row.clientId))} → ${accessLevelOrNone(level)}`
                          : row.grantedAt
                            ? `Granted ${formatDateTime(row.grantedAt)}${row.grantedByName ? ` by ${row.grantedByName}` : ""}`
                            : "No access"}
                    </span>
                  </div>

                  {/* A real select, so the form works without JavaScript. */}
                  <select
                    name={`access:${row.clientId}`}
                    value={level}
                    onChange={(event) =>
                      setLevel(row.clientId, event.target.value as Level)
                    }
                    aria-label={`Access to ${row.clientName}`}
                    className={cn(
                      "h-8 shrink-0 rounded-md border bg-card px-2 text-xs font-medium",
                      "text-foreground transition-[border-color] focus-visible:border-ring",
                      level === "EDIT"
                        ? "border-input border-l-2 border-l-[var(--positive)]"
                        : level === "VIEW"
                          ? "border-input border-l-2 border-l-[var(--progress)]"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    {LEVELS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ── Save ────────────────────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton changeCount={changed.length} />
          {changed.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={discard}
              className="text-muted-foreground"
            >
              Discard
            </Button>
          )}
          <span className="ms-auto text-xs text-muted-foreground">
            {grantedCount} of {rows.length} clients granted
          </span>
        </div>

        <Feedback state={state} />
      </div>
    </form>
  );
}

function accessLevelOrNone(level: Level | undefined): string {
  if (!level || level === "NONE") return "No access";
  return accessLevelLabel(level);
}

/**
 * The save button.
 *
 * Disabled while clean, so the button itself is the answer to "is there anything
 * to save" — and it counts the rows, because "Save 6 changes" is a different
 * decision from "Save 1 change".
 */
function SaveButton({ changeCount }: { changeCount: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending || changeCount === 0}>
      {pending && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending
        ? "Saving…"
        : changeCount === 0
          ? "No changes"
          : `Save ${changeCount} change${changeCount === 1 ? "" : "s"}`}
    </Button>
  );
}

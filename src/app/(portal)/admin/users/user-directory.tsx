"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/admin/form-bits";
import { Badge, Card, cn } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { Icons } from "@/components/ui/icons";
import { accessLevelLabel, roleLabel } from "@/lib/admin/labels";
import { formatDateTime } from "@/lib/tasks/format";

/**
 * The user directory.
 *
 * This replaces a six-column table that shared a page with the client list. Two
 * things were wrong with that, and both are about what a reader is actually
 * doing here.
 *
 * A row in that table had to answer "which clients, at what level" inside one
 * cell, so it said "2 clients · 1 editable" and put the real answer in a
 * `title` tooltip — a fact you could only reach with a mouse, and not at all on
 * a phone. Here each account is a card, and its clients are listed as chips that
 * name the client *and* the level, so the answer is on the screen.
 *
 * And a table sorted by role silently mixed two kinds of account that follow
 * different rules: staff read every client through their role, members read a
 * list. Splitting them into two sections makes that visible rather than
 * something you have to already know.
 *
 * The search and the filters are here rather than on the server because the
 * whole directory is a few dozen rows at most — filtering it is instant, and a
 * round trip per keystroke would be slower and worse.
 */

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  /** Set when the account has been removed. Removal is a mark, never a delete. */
  removedAt: string | null;
  isSelf: boolean;
  grants: { clientId: string; clientName: string; level: string }[];
};

type Filter = "all" | "staff" | "members" | "attention" | "removed";

/**
 * An account that can sign in but has nothing to look at, or cannot sign in at
 * all. Worth surfacing: it is always a setup somebody did not finish.
 */
function needsAttention(user: DirectoryUser): boolean {
  // A removed account is settled, not outstanding — flagging it would put a
  // permanent number on the filter that nobody can ever clear.
  if (user.removedAt) return false;
  if (!user.isActive || user.isLocked) return true;
  if (user.role === "PLATFORM_ADMIN") return false;
  return user.grants.length === 0;
}

export function UserDirectory({ users }: { users: DirectoryUser[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    // Every count except "removed" describes accounts that can actually sign in.
    const live = users.filter((u) => !u.removedAt);
    return {
      all: live.length,
      staff: live.filter((u) => u.role === "PLATFORM_ADMIN").length,
      members: live.filter((u) => u.role !== "PLATFORM_ADMIN").length,
      attention: live.filter(needsAttention).length,
      removed: users.length - live.length,
    };
  }, [users]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      // Removed accounts are hidden unless asked for by name or by the filter —
      // they are kept for the history they anchor, not to be browsed.
      const removed = Boolean(user.removedAt);
      if (filter === "removed") {
        if (!removed) return false;
      } else if (removed && !needle) {
        return false;
      }
      if (filter === "staff" && user.role !== "PLATFORM_ADMIN") return false;
      if (filter === "members" && user.role === "PLATFORM_ADMIN") return false;
      if (filter === "attention" && !needsAttention(user)) return false;
      if (!needle) return true;

      // Searching a client name finds the people who can see it, which is the
      // question that actually gets asked: "who can see Benchmark?"
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        user.grants.some((grant) =>
          grant.clientName.toLowerCase().includes(needle),
        )
      );
    });
  }, [users, query, filter]);

  const staff = visible.filter(
    (user) => !user.removedAt && user.role === "PLATFORM_ADMIN",
  );
  const members = visible.filter(
    (user) => !user.removedAt && user.role !== "PLATFORM_ADMIN",
  );
  const removedUsers = visible.filter((user) => user.removedAt);

  return (
    <div className="space-y-4">
      <Card>
        {/*
          The search and the filters stack on a phone and sit on one row from
          `lg`. They used to go side by side from `md`, where five segments and a
          search field do not fit: the segments were squeezed until "Needs
          attention" wrapped inside its own pill, and on a 390px screen the track
          overflowed the card entirely.

          On a phone the segmented track scrolls sideways instead of shrinking.
          A control that holds five named options cannot be made narrow enough
          for a phone without either truncating the names — which is what the
          filter is for — or wrapping to three rows of chips. Scrolling keeps
          every label whole and keeps the row one control tall; `-mx-1 px-1`
          lets the pill's shadow reach the edge instead of being clipped.
        */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a name, an e-mail, or a client…"
            aria-label="Search users"
            className="w-full min-w-0 lg:flex-1"
          />

          <div className="-mx-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
            <Segmented
              ariaLabel="Filter users"
              value={filter}
              onValueChange={setFilter}
              className="w-max lg:w-auto lg:shrink-0"
              options={[
                { value: "all", label: "Everyone", hint: counts.all },
                { value: "staff", label: "Staff", hint: counts.staff },
                { value: "members", label: "Members", hint: counts.members },
                { value: "attention", label: "Attention", hint: counts.attention },
                ...(counts.removed > 0
                  ? ([{ value: "removed", label: "Removed", hint: counts.removed }] as const)
                  : []),
              ]}
            />
          </div>
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-muted-foreground">
            No accounts match {query ? `"${query}"` : "that filter"}.
          </p>
        </Card>
      ) : (
        <>
          {staff.length > 0 && (
            <Section
              title="CFOSME staff"
              description="Read every client through their role, and manage the portal. They hold no per-client grants."
              users={staff}
            />
          )}
          {members.length > 0 && (
            <Section
              title="Members"
              description="See exactly the clients granted to them, at the level each grant gives."
              users={members}
            />
          )}
          {removedUsers.length > 0 && (
            <Section
              title="Removed"
              description="Hidden from the portal and unable to sign in. Their history, and the access they held, is kept — open one to restore it."
              users={removedUsers}
            />
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  users,
}: {
  title: string;
  description: string;
  users: DirectoryUser[];
}) {
  return (
    <Card title={`${title} (${users.length})`} description={description} flush>
      <ul>
        {users.map((user) => (
          <li
            key={user.id}
            className="border-b border-border/60 last:border-b-0"
          >
            <UserRow user={user} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * One account.
 *
 * The whole row is the link. A "Manage access" link in a trailing column makes a
 * 40px target at the far right of a wide row, and every reader who wants this
 * account wants that page — so the target is the row, and the chevron says so.
 */
function UserRow({ user }: { user: DirectoryUser }) {
  const attention = needsAttention(user);

  return (
    <Link
      href={`/admin/users/${user.id}`}
      className={cn(
        "flex items-start gap-3 px-5 py-4 transition-colors sm:gap-4",
        "hover:bg-muted focus-visible:bg-muted",
      )}
    >
      <Avatar name={user.name} muted={!user.isActive || Boolean(user.removedAt)} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-semibold text-heading">{user.name}</span>
          {user.isSelf && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
          <StatusBadge user={user} />
        </div>

        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {user.email}
        </p>

        <div className="mt-2">
          {user.removedAt ? (
            <span className="text-xs text-muted-foreground">
              Removed {formatDateTime(user.removedAt)} · history kept
              {user.grants.length > 0
                ? `, ${user.grants.length} grant${user.grants.length === 1 ? "" : "s"} retained`
                : ""}
            </span>
          ) : user.role === "PLATFORM_ADMIN" ? (
            <span className="text-xs font-medium text-foreground">
              Every client
              <span className="font-normal text-muted-foreground">
                {" "}
                · through {roleLabel(user.role).toLowerCase()}
              </span>
            </span>
          ) : user.grants.length === 0 ? (
            <span className="text-xs font-medium text-[var(--caution)]">
              No clients granted — this account signs in to an empty dashboard
            </span>
          ) : (
            <ClientChips grants={user.grants} />
          )}
        </div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-xs text-muted-foreground">Last signed in</p>
        <p className="text-xs font-medium whitespace-nowrap text-foreground">
          {formatDateTime(user.lastLoginAt)}
        </p>
      </div>

      <Icons.chevronRight
        className={cn(
          "mt-1 size-4 shrink-0 text-muted-foreground",
          attention && "text-[var(--caution)]",
        )}
      />
    </Link>
  );
}

/**
 * The clients an account holds, named.
 *
 * Capped, because a member granted all eighteen would otherwise push everything
 * below them off the screen. The level rides in the chip as a word, never as a
 * colour alone.
 */
function ClientChips({
  grants,
}: {
  grants: DirectoryUser["grants"];
}) {
  const MAX = 4;
  const shown = grants.slice(0, MAX);
  const hidden = grants.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((grant) => (
        <span
          key={grant.clientId}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
            grant.level === "EDIT"
              ? "border-[var(--positive)]/35 bg-[var(--tone-good-bg)] text-[var(--tone-good-fg)]"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          <span className="font-medium">{grant.clientName}</span>
          <span className="opacity-75">{accessLevelLabel(grant.level)}</span>
        </span>
      ))}
      {hidden > 0 && (
        <span className="text-xs text-muted-foreground">
          +{hidden} more
        </span>
      )}
    </div>
  );
}

function StatusBadge({ user }: { user: DirectoryUser }) {
  if (user.removedAt) return <Badge tone="neutral">Removed</Badge>;
  if (!user.isActive) return <Badge tone="bad">Deactivated</Badge>;
  if (user.isLocked) return <Badge tone="warn">Locked</Badge>;
  if (user.mustChangePassword) {
    return <Badge tone="warn">Must change password</Badge>;
  }
  return null;
}

/** Initials, so a list of accounts is scannable by shape as well as by name. */
function Avatar({ name, muted }: { name: string; muted: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        muted
          ? "bg-muted text-muted-foreground"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {initials || "?"}
    </span>
  );
}

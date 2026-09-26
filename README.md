# CFOSME Pulse Pro

The task register CFOSME runs its client work from. Practice staff see every
client's delivery, workload and deadlines; a client signs in and sees only their
own.

This is a fork of the RISEBIT CFO portal, which supplied the platform — Next.js,
authentication, sessions, multi-tenancy, the admin screens and the design system —
with the finance domain replaced by the task register. It succeeds a
single-file HTML dashboard (`CFOSME_Pulse_Pro_Task_Tracker.html`) that read the
workbook in the browser. What changed, and why:

| | Original | Now |
|---|---|---|
| Stack | One 900-line HTML file, SheetJS + Chart.js from a CDN | Next.js 16 · React 19 · TypeScript · Tailwind 4 |
| Who could see it | Anyone with the file — every client's tasks in one page | Per-client logins; a client sees only their own register |
| Edits | Mutated a JavaScript array, lost on refresh | Written to PostgreSQL, attributed, and kept as history |
| The workbook | Re-uploaded per browser, per person | Imported once, with a record of what each upload did |
| Due dates | 29 of 88 parsed; the other 59 reported as "no recognised date" | All 88 resolved, so Overdue counts the whole register |
| Status vs progress | Coupled inline in three handlers; a task could be Done at 60% | One rule, applied to edits and imports alike |
| Audit | None | Every sign-in, import, and task move recorded |

The operational runbook is [`docs/SOP.md`](docs/SOP.md); the design system is
[`docs/design-system.md`](docs/design-system.md).

---

## Getting started

Requires Node 20.11+ and a PostgreSQL database (Neon is what this targets).

```bash
npm install
cp .env.example .env.local     # then fill in DATABASE_URL
npm run db:deploy              # apply migrations
npm run db:seed                # the real register: 88 tasks, 18 clients
npm run dev
```

Open <http://localhost:3000>. The seed prints two passwords once.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection. On Neon, the `-pooler` host. Used at runtime. |
| `DIRECT_URL` | recommended | Unpooled connection. Migrations and seeding only. |
| `APP_URL` | yes | Canonical origin. Drives the `Secure` cookie flag and same-origin checks. |

`DATABASE_URL` and `DIRECT_URL` differ on Neon for a reason: serverless functions
must go through the pooler, but the pooler cannot run the DDL that
`prisma migrate` issues.

There is no encryption key and no cron secret. The portal this forked needed both
to hold Zoho OAuth tokens; nothing here stores a third-party credential, so they
are gone rather than left unused.

---

## Architecture

```
src/
  app/
    login/                  sign-in
    set-password/           forced change after an admin reset
    (portal)/               authenticated shell — sidebar, topbar, slicers
      dashboard/            the executive dashboard
        register/           the task register, editable in place
      account/              profile, password, active sessions
      admin/                clients & logins · workbook import · audit log
    api/
      auth/logout           POST, origin-checked
      tasks/export          GET, the register as .xlsx, honouring the filters
  lib/
    auth/                   sessions, password policy, guards, server actions
    tasks/                  the domain — see below
    security-headers.ts     CSP and the static security headers
    db.ts                   Prisma client singleton
  components/
    charts/                 Recharts wrappers with a validated palette
    dashboard/              KPI cards, slicer bar, bars, due watch
    shell/                  sidebar and topbar
```

### The task domain

`src/lib/tasks/` is where the work is. Each file has one job:

| File | What it owns |
|---|---|
| `types.ts` | The shapes, plus the fixed status and frequency orders every screen reads |
| `transition.ts` | How status and progress move together — the one copy of that rule |
| `due-date.ts` | Turning a spreadsheet cell into a date, or admitting it cannot |
| `workbook.ts` | Parsing and writing the .xlsx, faithfully in both directions |
| `import.ts` | Bringing a workbook in: upsert, client matching, counts, history |
| `scope.ts` | Who may see which tasks |
| `queries.ts` | One query per request, every figure derived from it |
| `actions.ts` | The two edits the register allows, authorised and audited |
| `format.ts` | Enum-to-English, in one direction only |

Three decisions worth knowing about:

**Figures are derived, never stored.** Completion, overdue counts and the client
and owner rollups are computed from `status` and `progress` at query time. A tile
on the dashboard therefore cannot disagree with the register behind it.

**The whole scoped register is loaded per request.** A practice runs a few hundred
recurring tasks, and the cross-filtered slicer counts need the full set anyway.
Past roughly ten thousand tasks this should become `groupBy` aggregates with the
table paginated; nothing above `loadRegister` would have to change.

**Due dates are stored twice.** `dueDate` is the resolved date the dashboard counts
as overdue; `dueText` keeps what the workbook actually said when the cell was not a
date. So "20th Sept " resolves *and* stays visible, and a cell that genuinely
cannot be read is visibly unresolved rather than silently dropped.

---

## The workbook

Excel remains the practice's working copy. The round trip is the point:

- **Import** — Administration → Workbook import. Matched on the workbook's own
  **Task ID**, so re-importing updates rather than duplicates. A client named in
  the sheet that the portal has not seen is created. A row that cannot be read is
  reported with its row number and the rest are still imported.
- **Export** — the Download button on the register writes the same fourteen
  columns back, with the enums turned into the words the practice uses. Re-importing
  what was just exported is a no-op, which is verified rather than assumed.

The import asks which month the workbook covers. That is not ceremony: the Due Date
column contains values like `20th Sept` with no year, and taking the month from the
clock would mean the same file imported in October produced different deadlines
than it did in September.

---

## Security

- Sessions are server-side and revocable. The cookie holds an opaque token; only
  its SHA-256 hash is stored, so a database dump cannot be replayed as a login.
  12-hour absolute expiry, 2-hour idle.
- Passwords are bcrypt at cost 12, with a stated policy, and a failed sign-in
  costs the same time whether or not the address exists.
- Every read is scoped in `taskScopeFilter`, not in the page, so a page that
  forgets to filter cannot leak another client's register. A hand-edited
  `?client=` cannot widen what a client login sees.
- Content-Security-Policy carries a per-request nonce, minted in the Edge proxy.
  The pre-paint theme script is pinned by a hash computed from the very string
  that gets rendered, so the two cannot drift.
- The export route is `force-dynamic` and `no-store`: a cached workbook would be
  one client's register served to another.

---

## Scripts

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` then `next build` |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:deploy` | Apply migrations |
| `npm run db:seed` | Seed the real register |
| `npm run db:studio` | Prisma Studio |
| `npm run hash` | bcrypt a password by hand |

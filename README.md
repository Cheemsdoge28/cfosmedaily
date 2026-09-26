# RISEBIT CFO Dashboard

Multi-client CFO dashboard portal. Each client signs in and sees only their own
management view of profitability, liquidity and working capital.

This is the v2 rebuild of the original PHP portal. What changed, and why:

| | Original | Now |
|---|---|---|
| Stack | PHP + a single 2,900-line `index.php` | Next.js 16 · React 19 · TypeScript · Tailwind 4 |
| Credentials | Hashes pasted into `config.php` | PostgreSQL (Neon), bcrypt, managed from an admin screen |
| Sessions | PHP session cookie | Server-side, revocable, hashed token, idle + absolute expiry |
| Data | Hard-coded JavaScript objects per client | Relational schema, one row per business unit per month |
| Filters | Selected between literals and applied fudge factors | Real database queries |
| Totals | Stored, and able to disagree with each other | Derived from stored inputs, so they always reconcile |
| Updating figures | Export from Zoho, re-key, re-upload the HTML | Zoho Books API, on demand or nightly |
| Audit | None | Every sign-in, credential change and sync recorded |

The operational runbook is [`docs/SOP.md`](docs/SOP.md).

---

## Getting started

Requires Node 20.11+ and a PostgreSQL database (Neon is what this targets).

```bash
npm install
cp .env.example .env.local     # then fill it in — see below
npm run keygen                 # prints APP_ENCRYPTION_KEY and CRON_SECRET
npm run db:deploy              # apply migrations
npm run db:seed                # demo client + two logins (passwords printed once)
npm run dev
```

Open <http://localhost:3000>.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection. On Neon, the `-pooler` host. Used at runtime. |
| `DIRECT_URL` | recommended | Unpooled connection. Migrations and seeding only. |
| `APP_ENCRYPTION_KEY` | yes | base64 32-byte AES-256-GCM key for stored Zoho tokens. |
| `CRON_SECRET` | for cron | Bearer token the scheduled sync endpoint requires. |
| `APP_URL` | yes | Canonical origin. Drives the `Secure` cookie flag and the Zoho redirect URI. |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` | for Zoho | From <https://api-console.zoho.com>. |
| `ZOHO_REGION` | for Zoho | Data centre: `com`, `in`, `eu`, `au`, `jp`, `ca`, `sa`. |

`DATABASE_URL` and `DIRECT_URL` differ on Neon for a reason: serverless
functions must go through the pooler, but the pooler cannot run the DDL that
`prisma migrate` issues.

---

## Architecture

```
src/
  app/
    login/                  sign-in
    set-password/           forced change after an admin reset
    (portal)/               authenticated shell — sidebar, topbar, filters
      dashboard/            the seven CFO modules
      account/              profile, password, active sessions
      admin/                clients, logins, Zoho, audit log
    api/
      auth/logout           POST, origin-checked
      zoho/                 connect · callback · disconnect
      cron/sync             nightly sync, CRON_SECRET protected
  lib/
    auth/                   sessions, password policy, guards, server actions
    finance/                derivation, queries, formatting
    zoho/                   OAuth, API client, report mapping, sync
    crypto.ts               AES-256-GCM, SHA-256, constant-time compare
    db.ts                   Prisma client singleton
  components/
    charts/                 Recharts wrappers with a validated palette
    dashboard/              KPI cards, filter bar, shared module frames
    shell/                  sidebar and topbar
prisma/
  schema.prisma             15 tables
  seed.ts                   demo data
```

### The one idea worth knowing

**Only inputs are stored.** The database holds revenue, COGS, opex,
depreciation, finance cost, tax, and closing balances. Gross profit, EBITDA, net
profit, every margin, the YTD position, the consolidated "All Units" view and
operating cash flow are all computed in `src/lib/finance/derive.ts` at query
time.

That is the fix for the original's central flaw: it stored revenue *and* EBITDA
*and* net profit separately, then scaled each by its own factor, so the P&L, the
KPI cards and the bridge could quietly disagree. They no longer can.

Cash flow follows the same rule. Operating cash flow is derived from the
movement between opening and closing cash after investing and financing, so
`opening + OCF − capex + financing = closing` holds exactly.

---

## Onboarding a client

All of it lives at **Clients** in the sidebar, for platform administrators. Each
client then gets a setup page that shows the four steps and which are done.

1. **Add a client** — name, slug, currency, the month its fiscal year starts,
   its business units, and how many fiscal years to create. Fiscal years are
   created here rather than later because the dashboard resolves its filters
   against them and a Zoho sync refuses any month no fiscal year covers. The
   first login can be created in the same step.
2. **Logins** — one account per person, never a shared login, so the audit log
   says who actually signed in. Each gets a temporary password shown once and
   must change it at first sign-in. Roles, resets and deactivation are on the
   same table.
3. **Connect Zoho Books** — per client. If the Zoho account can see several
   organizations, pick the right one.
4. **Import figures** — a month range, defaulting to every fiscal year the
   client has. Check the first import against the Zoho reports before telling
   the client: account names vary between charts of accounts, and a line that
   matched no pattern comes through as zero.

Figures can also be entered by hand — see SOP §9. Only inputs are stored; never
enter a calculated total.

---

## Security

- **Passwords** — bcrypt cost 12, never in a config file. Policy enforced on
  every change: 12+ characters, mixed case, a digit and a symbol.
- **Sessions** — the cookie holds a random 32-byte token; only its SHA-256 hash
  is stored, so a database dump cannot be replayed as a login. HttpOnly,
  SameSite=Lax, Secure when `APP_URL` is HTTPS. 12-hour absolute and 2-hour idle
  expiry. Revoked on logout, password change and deactivation.
- **Brute force** — five failed attempts locks an account for 15 minutes.
  Unknown e-mails still run a bcrypt comparison, so timing does not reveal
  whether an account exists.
- **Tenant isolation** — every query is scoped by the `clientId` on the session.
  `src/lib/auth/guard.ts` is the only way into a protected page.
- **Defence in depth** — `src/proxy.ts` (edge) only checks that a cookie is
  present; it cannot reach the database. The real check runs in the server
  layout on every request.
- **Zoho tokens** — refresh and access tokens are AES-256-GCM encrypted at rest
  and never sent to the browser.
- **Headers** — CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, a restrictive
  `Permissions-Policy`, and `frame-ancestors 'none'`.
- **Audit** — sign-ins, failures, lockouts, password changes, user
  administration and every sync are written to `AuditLog`.

Known advisories: `npm audit` reports findings against `mysql2` and
`deepmerge-ts`, both transitive dependencies of the **Prisma CLI**. They are dev
dependencies, are not part of the deployed runtime, and npm's suggested "fix" is
a downgrade to Prisma 6. Left as-is deliberately.

---

## Zoho Books integration

1. Create a **Server-based Application** at <https://api-console.zoho.com>.
2. Set the authorized redirect URI to `{APP_URL}/api/zoho/callback`.
3. Put the client ID and secret in the environment.
4. Sign in as a platform admin, open **Zoho Integration**, and connect each
   client.

A sync pulls Profit & Loss, Balance Sheet, Cash Flow and both ageing summaries,
one month at a time, and writes them as stored inputs tagged `ZOHO_BOOKS` —
which keeps Zoho-reported figures distinguishable from manually entered ones.

Zoho's report payloads are nested trees whose labels vary between charts of
accounts, so `src/lib/zoho/mappers.ts` flattens them and matches account names
against documented patterns. **Check the first sync of a new client against the
Zoho reports**, and extend the patterns if a line comes through as zero.

The nightly job runs at 01:30 UTC via `vercel.json`, calling `/api/cron/sync`
for every client with auto-sync enabled.

---

## Charts

Palettes were checked with a validator rather than chosen by eye:

- Revenue vs EBITDA — adjacent CVD ΔE 24.7, normal-vision ΔE 33.6, both marks
  above 3:1 contrast.
- Ageing ramp — monotone lightness, adjacent ΔL ≥ 0.06, light end 2.11:1, single
  hue.

Rules the chart code holds to: one y-axis, never two; colour follows the entity
so filtering never repaints a series; nominal categories (expense heads) get one
hue rather than a value ramp; ordered categories (ageing bands) get the ordinal
ramp.

The expense doughnut became a ranked horizontal bar — a doughnut makes close
values hard to compare, and the CFO question is "where is the money going",
which a ranked bar answers directly.

---

## Deploying to Vercel

1. Import the repository.
2. Add every environment variable from the table above.
3. Attach a Neon database; set `DATABASE_URL` to the pooled string and
   `DIRECT_URL` to the direct one.
4. Deploy. The build runs `prisma generate && next build`.
5. Apply migrations once from your machine (`npm run db:deploy`) against
   `DIRECT_URL`.
6. Confirm the cron job appears under the project's Cron Jobs tab.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Generate the Prisma client, then build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run keygen` | Generate `APP_ENCRYPTION_KEY` and `CRON_SECRET` |
| `npm run hash -- "pw"` | bcrypt hash, for recovery only |

---

## Toolchain notes

- **TypeScript is pinned to 5.x.** `typescript-eslint` does not yet support
  TypeScript 7, so linting breaks on it. Revisit when it does.
- **ESLint is pinned to 9.x.** `eslint-plugin-react`, pulled in by
  `eslint-config-next`, is not ESLint 10 compatible.
- **`src/proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention.
- **Prisma 7** runs without the Rust query engine, so a driver adapter is
  required — `@prisma/adapter-pg`, configured in `src/lib/db.ts`. Connection
  URLs live in `prisma.config.ts`, not in `schema.prisma`.

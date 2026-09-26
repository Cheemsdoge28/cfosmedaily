# RISEBIT CFO — Client Dashboard Portal

## Standard Operating Procedure, version 2.0

Supersedes version 1.0 (Hostinger + PHP + HTML). This edition covers the
Next.js portal backed by a PostgreSQL database and the Zoho Books API.

**Who this is for:** the RISEBIT CFO team who onboard clients, publish
dashboards and hold the credentials.

---

## 1. Purpose

Defines how client CFO dashboards are created, secured, deployed, updated and
maintained on the RISEBIT CFO portal, so that each client signs in and sees only
the figures belonging to them.

---

## 2. What changed from version 1.0, and why

| v1.0 | v2.0 | Reason |
|---|---|---|
| A dashboard was a hand-edited HTML file per client | One application; data separates clients | A fix or a design change had to be repeated in every client's file |
| Credentials lived in `config.php` | Credentials live in the database | Editing a PHP file to add a login is slow and easy to break |
| Adding a client meant uploading a file and editing config | Adding a client is a form | Fewer steps, no syntax errors, and it is audited |
| Figures were typed into JavaScript objects | Figures are rows in a database | Re-keying is where numbers go wrong |
| Updating meant exporting from Zoho and re-keying | Zoho Books is read through its API | Removes the manual step entirely |
| Totals were stored alongside their components | Totals are calculated from components | Stored totals drift out of agreement |
| No record of who did what | Full audit log | Needed for any client-facing financial system |

**The v1.0 flaw worth naming.** The old dashboard stored revenue, EBITDA and net
profit as separate numbers, then scaled each by its own factor when a filter
changed. The file said as much in a comment: *"Historical FY EBITDA factors
intentionally differ from revenue factors."* The result was that the KPI cards,
the P&L table and the profitability bridge could each show a different answer for
the same period. In v2.0 only inputs are stored and every subtotal is derived, so
they cannot disagree.

---

## 3. System architecture

```
Client browser
      |
      v
  risebitcfo.com  (Next.js on Vercel)
      |
      +-- sign-in  -> server-side session, database-backed
      +-- portal   -> seven CFO modules, tenant-scoped queries
      +-- admin    -> clients, logins, Zoho connections, audit log
      |
      v
  PostgreSQL (Neon)          Zoho Books API
  credentials + figures  <--  nightly + on-demand sync
```

There is no per-client file and no per-client URL. The signed-in session decides
which tenant's rows are readable.

---

## 4. Security principles

1. Authentication is server-side. The browser never decides what it may see.
2. Passwords are bcrypt hashes in the database. Plaintext is never stored, and
   temporary passwords are displayed exactly once.
3. The session cookie holds a random token; only its SHA-256 hash is stored.
4. Sessions expire after 12 hours absolute and 2 hours idle, and are revoked on
   logout, password change and deactivation.
5. Five failed sign-ins lock an account for 15 minutes.
6. Every query is scoped to the session's client. One tenant cannot read
   another's rows.
7. Zoho tokens are AES-256-GCM encrypted at rest and never reach the browser.
8. Sign-ins, credential changes and syncs are written to the audit log.

---

## 5. Roles

| Role | May do |
|---|---|
| `PLATFORM_ADMIN` | Everything: create clients and logins, reset passwords, connect Zoho, read the audit log |
| `CLIENT_ADMIN` | Their own client's dashboard; manage their own password |
| `VIEWER` | Their own client's dashboard, read-only |

Platform admin accounts belong to RISEBIT staff and are not tied to a client.

---

## 6. Environment and secrets

Secrets live in the Vercel project, never in the repository.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection (the `-pooler` host) |
| `DIRECT_URL` | Neon **direct** connection — migrations only |
| `APP_ENCRYPTION_KEY` | base64 32-byte key; `npm run keygen` |
| `CRON_SECRET` | Bearer token for the nightly sync |
| `APP_URL` | e.g. `https://risebitcfo.com` |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REGION` | From the Zoho API console |

**Rotating `APP_ENCRYPTION_KEY` makes stored Zoho tokens unreadable.** Every
client must be reconnected afterwards. Plan it deliberately.

---

## 7. Onboarding a new client

The whole flow lives at **Clients** in the sidebar (platform administrators
only). Each client then has its own setup page showing the four steps and which
are done.

### 7.1 Create the client

**Clients** → *Add a client*.

- **Name** — as it should appear in the dashboard header.
- **Slug** — lowercase, used internally; do not change it casually.
- **Currency** — three-letter code. INR is presented in lakhs and crores.
- **FY starts in** — April for Indian entities.
- **Business units** — comma separated, e.g. `Manufacturing, Trading`. Leave
  blank for a single consolidated unit. These become the *Business Unit* filter;
  "All Units" is their sum, not a unit of its own.
- **Fiscal years to create** — two by default, so the dashboard has a prior year
  to compare against. Fewer and every year-on-year column reads "no comparative
  period".
- **First login** *(optional)* — creates a client administrator in the same
  step. Leave blank to add logins later.

Creating the client also creates its fiscal years. This matters: the dashboard
resolves its filters against them, and a Zoho sync refuses any month that no
fiscal year covers rather than guessing.

You are then taken to the client's setup page.

### 7.2 Give each person a login

On the client's page, **2 · Logins** → *Add a login*.

**One account per person. Never a shared login** — the audit log is only useful
if it says who actually signed in.

- **Viewer** — read-only access to that client's dashboard.
- **Client administrator** — the same dashboard; the role records who is
  accountable for the account.

Each login gets a temporary password that is **shown once**. Copy it
immediately and send it over a secure channel, separately from the e-mail
address. Never e-mail the two together and never put either on the public
website. The user is forced to change it at first sign-in.

Existing accounts can be changed from the same table: switch a role and *Save*,
*Reset password* (which also signs that person out everywhere), or *Deactivate*.

### 7.3 Load the figures

Either connect Zoho Books (section 8) or enter figures directly (section 9).

### 7.4 Test before delivery

Run the checklist in section 12.

---

## 8. Connecting Zoho Books

### 8.1 One-time platform setup

1. At <https://api-console.zoho.com>, create a **Server-based Application**.
2. Authorized redirect URI: `{APP_URL}/api/zoho/callback` — exactly, including
   scheme and any trailing path.
3. Put the client ID and secret in the Vercel environment.
4. Set `ZOHO_REGION` to the client's data centre (`in` for Zoho India).

### 8.2 Per client

On the client's setup page, **3 · Zoho Books** → *Connect Zoho Books* → approve
on Zoho's consent screen. You are returned with the organization linked and the
status showing **Connected**.

If the Zoho login can see more than one organization, a picker appears —
choose the one whose books belong to this client. With a single organization it
is bound automatically.

**Zoho Integration** in the sidebar shows the same status across every client at
once, which is the quicker way to spot a connection that has gone stale.

### 8.3 Importing figures

**4 · Import figures** on the client's page takes a month range. It defaults to
every fiscal year the client has, which is what a first import wants: two full
years so the dashboard has a prior year to compare against. Later imports can be
narrowed to the months that changed.

Each month pulls the Profit & Loss, Balance Sheet, Cash Flow and both ageing
summaries. A month that no fiscal year covers is reported rather than guessed
at, so add the fiscal year first and re-run.

### 8.4 Validate the first sync

**This step is not optional.** Zoho's report labels differ between charts of
accounts, so the first sync for a new client must be checked:

1. Run *Sync now* and note the months processed and records written.
2. Open the Zoho Books P&L for the latest synced month.
3. Compare revenue, COGS, operating expenses and net profit against the
   dashboard.
4. Compare the Balance Sheet cash, receivables, payables and inventory.
5. If a line reads zero that should not, the account name did not match a
   pattern. Extend `src/lib/zoho/mappers.ts` and re-sync.

Record the comparison. This is the v2.0 equivalent of "review figures before
publishing".

### 8.5 What the mapping relies on

Zoho's report endpoints are not publicly documented. The following was
established against a live organization and is what `src/lib/zoho/mappers.ts`
depends on — worth knowing before changing it.

- **Rows hang off a report-named key**: `profit_and_loss`, `balance_sheet`,
  `cash_flow`. The parser follows any array rather than a fixed list of keys.
- **The caption that identifies a subtotal is `total_label`**
  ("Total Operating Income"), not `name` ("Operating Income"). Both are indexed.
- **Cash is two sibling sections**, "Cash" and "Bank"; the closing position is
  their sum.
- **The balance sheet is the as-at source.** The cash flow report returns the
  same beginning and ending balance whatever period is requested, so it is used
  only for investing and financing flows.
- **Ageing takes `to_date`, never `filter_by`** — passing `filter_by` is
  rejected. The payload is `invoice` / `bills` as an object, with `intervals`
  for the bands and a nested, recursive `group_list` for counterparties. Only
  the leaves of that tree are real counterparties; the parent nodes are
  subtotals and counting them would double the balances.
- **Ageing bands are an organization setting.** One org reports
  1-15 / 16-30 / 31-45 / above-45; another may use 30-day bands. They are stored
  exactly as reported rather than remapped, so the dashboard shows the same
  bands as the client's own Zoho report.

Every sync checks its own arithmetic: the net profit derived from the mapped
figures is compared against the "Net Profit/Loss" Zoho itself reports, and a
mismatch is recorded on the sync run. That check is what catches an account
which matched no pattern and came through as zero.

### 8.6 Ongoing

The nightly job at 01:30 UTC re-syncs every client with auto-sync enabled.
Sync history, including failures, is shown per client on the integrations page.

---

## 9. Entering figures without Zoho

Use Prisma Studio. One `MonthlySnapshot` row per business unit per month.

Enter **only** these, in base currency units — rupees, not lakhs:

| Field | Meaning |
|---|---|
| `revenue` | Operating income |
| `cogs` | Cost of goods sold |
| `opex` | Operating expenses, excluding depreciation, finance cost and tax |
| `depreciation` | Depreciation and amortisation |
| `financeCost` | Interest and bank charges |
| `taxExpense` | Income tax |
| `otherIncome` | Non-operating income |
| `cashAndBank` | Closing cash |
| `receivables`, `payables`, `inventory` | Closing balances |
| `capex` | Capital expenditure in the period (positive) |
| `financingNet` | Net financing: negative for repayments |

**Do not look for gross profit, EBITDA or net profit fields.** They do not
exist, by design. They are calculated.

Leave `source` as `MANUAL` so manually entered figures stay distinguishable from
Zoho-sourced ones.

---

## 10. Dashboard content standard

The seven modules, unchanged in purpose from v1.0:

1. Executive Dashboard — profitability, liquidity, working capital, attention list
2. Profit & Loss — monthly columns or YTD against the prior year
3. Cash Flow — indirect method, reconciled to the balance movement
4. Receivables — ageing and the largest customer balances
5. Payables — ageing and the largest supplier balances
6. Bank & Liquidity — balances, reconciliation, liquidity cover
7. MIS Reports — KPIs against target, and period-on-period movement

A dashboard should answer, quickly: what is revenue; what is profitability; where
is cash; what is owed to us; what we owe; where expenses are rising; what needs
management attention.

Management targets drive the MIS variance columns. Add them as `KpiTarget` rows
per fiscal year; a metric with no target shows "No target" rather than an
invented one.

---

## 11. Design standard

Carried forward from v1.0 and now enforced by the shared components:

- RISEBIT CFO branding, client name, and the reporting period visible.
- The active filters are echoed under every module heading.
- Headline KPIs at the top of each module.
- Readable on a phone: tables scroll rather than clip, the sidebar becomes a
  drawer, KPI cards go two across.
- The Logout button is always visible in the top bar.
- Print/PDF drops the chrome and prints the figures.
- No client's data is ever reachable from another client's session.

Chart rules are not stylistic preferences — they are in place because the
alternatives mislead. No dual axes. Colour follows the entity, so filtering never
repaints a series. Ordered bands get an ordinal ramp; unordered categories get a
single hue. Palettes were validated for colour-vision deficiency and contrast.

---

## 12. Testing before client delivery

Run every one of these. Record the date and who ran them.

**Authentication**

- [ ] Correct credentials open the correct client's dashboard.
- [ ] Wrong password is rejected with a generic message.
- [ ] Five wrong passwords lock the account; the message says so.
- [ ] Logout returns to the sign-in page.
- [ ] After logout, opening `/dashboard` directly redirects to sign-in.
- [ ] A private browsing window cannot reach a dashboard without signing in.
- [ ] A newly created login is forced to change its password before entry.

**Isolation**

- [ ] Client A's credentials show only client A's figures.
- [ ] Client B's credentials show only client B's figures.
- [ ] Two accounts on the same client both see that client, and only it.
- [ ] A `VIEWER` cannot open `/admin`, and sees no admin links in the sidebar.

**Figures**

- [ ] Executive, P&L and MIS agree on revenue, EBITDA and net profit for the
      same period.
- [ ] Switching Monthly/YTD changes the figures coherently.
- [ ] "All Units" equals the sum of the individual business units.
- [ ] Cash flow reconciles: opening + OCF − capex + financing = closing.
- [ ] Against Zoho Books, or the client's own statements, for one month.

**Presentation**

- [ ] Readable on a phone; no horizontal page scroll.
- [ ] Logout visible on mobile.
- [ ] Print/PDF produces a usable document.

---

## 13. Update cycle

```
New period closed in Zoho Books
        |
        v
Sync (nightly, or "Sync now")
        |
        v
Review the figures against the source reports
        |
        v
Note anything that needs a mapping change
        |
        v
Confirm to the client that the period is published
```

There is no file to back up and no file to replace. The database is the record,
and Vercel keeps every previous deployment of the application.

---

## 14. Password and access management

**Resetting a password.** **Clients** → the user's row → *Reset password*. A new
temporary password is shown once, all their sessions are signed out, and they
must change it at next sign-in.

**Changing a role.** Pick the new role in the user's row and *Save*. Both roles
see the same dashboard; the role records who is accountable for the account.

**Removing access.** *Deactivate*. The account is refused immediately and all its
sessions are revoked. Deactivate rather than delete — deleting removes the audit
trail attached to the account.

**Adding a colleague.** A client can have as many accounts as it needs. Add one
per person from the client's setup page; never issue a shared login.

**Leavers.** Deactivate the same day. Confirm in the audit log that no sign-in
follows.

**A user changing their own password** signs out every other device
automatically.

---

## 15. Backups and recovery

Neon provides point-in-time restore; confirm the retention window on the plan in
use and check it covers at least the last two reporting cycles.

Before a schema migration on production data:

1. Take a Neon branch or snapshot.
2. Apply the migration to a branch first and confirm the dashboard still reads
   correctly.
3. Apply to production.
4. Verify one client's figures immediately afterwards.

Application code is in Git. Rolling back a bad deployment is a Vercel rollback,
not a file restore.

---

## 16. Change management

For any material change, record: date, client, what changed, source reports used,
who did it, and what was tested. The audit log covers access and sync events
automatically; this record covers everything else.

---

## 17. Troubleshooting

| Symptom | Where to look |
|---|---|
| Sign-in rejected | Is the account active and unlocked? Check the audit log for `auth.login.*` |
| "Temporarily locked" | Five failed attempts. Wait 15 minutes, or reset the password to clear it |
| Dashboard shows "No financial data" | The client has no fiscal year, or no snapshots in it |
| A figure is zero after a sync | The Zoho account name did not match a pattern in `src/lib/zoho/mappers.ts` |
| Sync fails with an authorisation error | The refresh token was revoked in Zoho. Reconnect |
| Sync fails on every month | Check `ZOHO_REGION` matches the client's data centre |
| "All Units" does not equal the sum of units | A business unit is missing a snapshot for that month |
| Cash flow looks wrong | Check the previous month exists — opening cash comes from it |
| Everything 500s after a deploy | `DATABASE_URL` missing, or migrations not applied |

---

## 18. Do and don't

**Do**

- Keep secrets in the Vercel environment.
- Validate the first sync of every new client against the source reports.
- Deactivate leavers the same day.
- Test isolation with two clients before delivery.
- Take a database snapshot before a schema migration.

**Don't**

- Put credentials, client figures or dashboard links on the public website.
- E-mail a username and its password together.
- Reuse a temporary password, or send one that was already shown.
- Enter a calculated total into the database — it will be ignored or will
  conflict with the derived one.
- Rotate `APP_ENCRYPTION_KEY` without planning to reconnect every client.
- Point `DATABASE_URL` at the unpooled Neon host in production.

---

## 19. Public website

The marketing site must not display client financial information, usernames,
passwords or dashboard links. A **Client Login** button pointing at the portal
sign-in page is the only connection between them.

---

## 20. Planned work

Not yet built, in the order it is most useful:

1. A figures editor, so section 9 stops needing Prisma Studio.
2. CSV import as a fallback for clients not on Zoho Books.
3. Scheduled PDF delivery to a client's finance team.
4. Mapping Zoho branches onto business units, so segment detail syncs
   automatically rather than landing on the default unit.
5. Letting client administrators add their own colleagues, so RISEBIT is not in
   the loop for every new viewer.

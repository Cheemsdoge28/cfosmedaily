# CFOSME Pulse Pro — Task Register Portal

## Standard Operating Procedure, version 1.0

**Who this is for:** the CFOSME team who maintain the task register, onboard
clients and give their people access.

**What this covers:** the monthly working rhythm, importing the workbook,
onboarding a client, access management, and what to do when something looks
wrong.

You do not need to understand the code to follow this. Where a step needs a
developer, it says so.

---

## 1. Purpose

CFOSME runs a recurring calendar of accounting, compliance and reporting work
across its clients. That calendar lives in **CFOSME_Task_Tracker.xlsx**, and it
still does — this portal does not replace the workbook. It gives the register:

- a **dashboard** that answers "where does the month stand" without anyone
  building a pivot;
- a **register** that several people can edit at once, where an edit survives a
  refresh and is recorded against the person who made it;
- **per-client access**, so a client can be shown their own tasks without being
  shown anyone else's.

---

## 2. What changed from the workbook dashboard

The previous dashboard was a single HTML file that read the workbook in the
browser. It worked, and it had four limits worth naming, because they explain why
some things now behave differently:

1. **Edits were not saved.** Moving a task to Done changed a value in the page
   and nothing else; closing the tab lost it. Edits now persist.
2. **Everyone saw everything.** Whoever had the file had all eighteen clients.
   Access is now per client.
3. **Two-thirds of the due dates were ignored.** The Due Date column holds real
   dates on 29 rows and text an operator typed — `20th Sept`, `3rd Sept` — on the
   other 59. The old dashboard read only the first kind and listed the rest as
   "no recognised due date", so its Overdue figure was counting a third of the
   register. All 88 now resolve, which means **the Overdue number is higher than
   you are used to seeing, and it is the correct one.**
4. **A task could be Done at 60%.** One is in the workbook today (TS0011). Status
   and progress are now kept consistent — see §6.

---

## 3. Roles

There are two roles, and then a list of grants.

| Role | Who | Can do |
|---|---|---|
| **CFOSME staff** | The practice | Every client. Import the workbook, manage clients and logins, read the audit log. |
| **Member** | Everyone else | Exactly the clients granted to them, and nothing else. |

A member's access is granted **one client at a time**, and each grant is either:

| Level | Means |
|---|---|
| **View only** | They can see the dashboard and register for that client. |
| **Can edit** | They can also move tasks — set a status, drag progress. |

Because the level is per client, one person can be **read-write on one client and
read-only on another**. That is the normal case for a reviewer who owns some
clients and only checks others, and it is why access is not a property of the
account.

A member can never see a client they have not been granted. This is enforced when
the data is fetched, not by hiding things on screen, so it cannot be worked around
by editing the address bar.

**Staff hold no grants.** CFOSME staff read every client through their role. That
is deliberate: if staff were granted each client one at a time, every new client
would need granting again to everyone, and would be invisible until someone
remembered.

---

## 4. The monthly rhythm

The register is worked month by month. A normal month looks like this:

**At the start of the month**

1. Update **CFOSME_Task_Tracker.xlsx** as usual — new tasks, changed owners,
   changed due dates.
2. Sign in to the portal and go to **Administration → Workbook import**.
3. Choose the file, and set **Month this workbook covers** to the month the
   register is for (see §5 — this matters).
4. Import. Read the result line: created, updated, unchanged, skipped.
5. If anything was skipped, fix those rows in the workbook and import again.
   Importing twice is safe.

**Through the month**

6. The team works in **Task Register**, setting status and dragging progress.
   Nothing needs saving; each change is written as it is made.
7. Use the **Executive Dashboard** for the standing questions — who is behind,
   what is overdue, where the work is concentrated.

**At the end of the month**

8. Press **Download workbook** on the register. That writes the same fourteen
   columns back out, including who last moved each task and when.
9. Keep that file as the month's record, and start the next month from it.

---

## 5. Importing the workbook

### 5.1 What it matches on

Tasks are matched on the workbook's own **Task ID** (`TS0001`). That has three
consequences worth knowing:

- Importing the same file twice **updates** rather than duplicating.
- Correcting a task's **Client** cell **moves** the task to that client. It does
  not create a copy.
- **Changing a Task ID creates a new task** and leaves the old one behind. If you
  need to renumber, tell a developer rather than doing it in the workbook.

A client named in the sheet that the portal has not seen before is **created
automatically**, so taking on a new client needs no separate step.

### 5.2 Why it asks for the month

Because `20th Sept` does not say which September. The month you choose is what
resolves that. Dates already written in full are unaffected.

Set it to the month the register is for — not today's month. Importing September's
workbook in October with "October" selected would date every one of those tasks a
month late.

### 5.3 What the sheet must contain

A sheet named **Tasks** (or the first sheet), with a header row containing
**Task ID**. Column order does not matter; the names do.

Required on every row: **Task ID**, **Client**, **Owner**, **Frequency**.
Everything else may be blank.

- **Frequency** must be one of: Daily, Weekly, Fortnightly, Monthly, Quarterly,
  Half-yearly, Annual, Ad hoc.
- **Status** may be Done, In progress, At risk, Blocked, Not started. A blank
  Status is taken as Not started. A word that is *not* one of these is reported
  rather than guessed at — that is deliberate, because guessing would hide a typo.
- **Progress %** may be a number or blank. A percentage-formatted cell (0.6) is
  read as 60%.

### 5.4 When rows are skipped

A row that cannot be read does not fail the import. The rest go in, and the
skipped rows are listed by row number with the cell at fault — for example
*"Row 43 (TS0042): 'Quartely' is not a frequency this register knows."*

Fix them in the workbook and import again. The list also stays on the import page
until the next import, so you can come back to it.

### 5.5 What gets recorded

Every import is kept with its counts and who ran it, on the same page. Every task
the import actually moved also gets a history entry marked as coming from a
workbook, so a figure that arrived by upload is distinguishable from one somebody
set by hand.

---

## 6. Status and progress

These two are kept consistent, and the rule is worth knowing because it will
occasionally move a figure you did not touch:

| You do this | This happens |
|---|---|
| Set status to **Done** | Progress goes to 100% |
| Drag progress to **100%** | Status becomes **Done** |
| Drag a **Done** task below 100% | Status drops to **In progress** (or Not started at 0%) |
| Move a **Done** task to another status | Progress resets, because 100% would snap it straight back |
| Drag a **Blocked** task to 40% | It stays **Blocked** — progress says nothing about why it is stuck |

The same rule is applied to imports. A row that arrives as Done at 60% is stored
as In progress at 60%: the progress figure is the one somebody typed a number
into, so it is trusted and the status is corrected to match.

---

## 7. Onboarding a client

Most clients need no onboarding at all — the import creates them. You only need
this when a client's own people are to be given access.

1. **Administration → Clients & logins**.
2. If the client is not listed (no tasks imported yet), use **Add a client**.
   The **Client name must match the workbook's Client column exactly**, because
   that is what imports match on. A mismatch creates a second client.
3. Use **Add a login**: the person's name and e-mail. Give them a first client
   and a level now, or leave the client as *None* and grant clients afterwards —
   which is the right order for someone who will cover several.
4. A **temporary password is shown once**. Send it over a different channel from
   the e-mail address — not in the same message. They must change it at first
   sign-in.
5. Open **Manage access** on their row to add the rest of their clients.

### Managing someone's access

**Clients & logins → Manage access** on a person shows everything about that
account in one place:

- **Client access** — every client they hold, at what level, when it was granted
  and by whom. Switch a client between *View only* and *Can edit*, or remove it.
- **Grant a client** — add one more.
- **Everything at once** — grant every active client at one level, for someone who
  covers the whole book. This is a **snapshot**: clients onboarded later are *not*
  added automatically. There is also a *Remove all access*, which strips every
  client and signs them out.
- **Active sessions** — where they are currently signed in, with a way to end one
  or all of them.
- **Password and account** — reset the password, or deactivate the account.
- **Role** — promote to CFOSME staff, or demote. Promoting removes the per-client
  grants as redundant; demoting therefore leaves the account with **no access at
  all** until you grant some.

A revoked client stops being visible on that person's **next page load**. You do
not have to wait for their session to expire, and you do not have to sign them out.

The logins list flags an active account with **no access granted**, because an
account that can sign in and see nothing is a setup someone forgot to finish.

### Suspending a client

**Suspend** on the client's row signs out everyone at that client and makes their
register read-only. Their tasks and history are kept. **Reactivate** restores
access.

---

## 8. Access management

- Passwords must be at least 12 characters with an uppercase letter, a lowercase
  letter, a digit and a symbol.
- Five failed attempts locks the account for a period. It clears on a password
  reset.
- **Reset password** issues a new temporary password and signs that person out
  everywhere.
- **Sign out everywhere** ends every session without changing the password — the
  right tool for a lost laptop.
- Changing someone's **role** signs them out, because what they can see changes.
- **Deactivate** blocks a login and signs them out. Use it the day someone
  leaves. You cannot deactivate your own account.
- A session ends after **12 hours** regardless, or **2 hours** of inactivity.
- Anyone can see their own active sessions under **Account settings**, and
  changing a password signs out every other device.

---

## 9. Reading the dashboard

| Figure | What it means |
|---|---|
| **Completion** | Average progress of the tasks in view. Not "share done" — four tasks all at 90% is a client nearly finished, and 0% would not describe that. |
| **Tasks in view** | How many the slicers leave. |
| **Completed** | Status is Done. |
| **Needs attention** | In progress, at risk or blocked. Deliberately *not* everything unfinished: on the 1st every monthly task is Not started and that needs no attention. |
| **Overdue** | Open, and past a due date. A task finished late is not overdue; it is done. |

**Completion by client** lists the weakest first, so whoever needs help is never
below the fold. A client with overdue work shows a red bar whatever its
percentage.

**Due date watch** also reports *"No recognised due date"*. On a clean workbook
this should be **zero**. Above zero means a Due Date cell nobody can read, and
those tasks are excluded from Overdue — so treat it as a workbook to correct.

Every slicer shows a count beside each option: how many tasks that choice would
leave *given what is already selected*. An option showing 0 is a dead end.

---

## 10. Before showing it to a client

1. Sign in as that client's own login, not yours, and confirm you see **only**
   their tasks.
2. Check the client slicer is fixed to them.
3. Check the Overdue figure against the workbook, and that "No recognised due
   date" is zero.
4. If they are a Viewer, confirm the status and progress controls are not
   editable.
5. Use **Print / PDF** if they want a copy — the chrome drops away and the
   figures fill the page.

---

## 11. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "The table `public.User` does not exist" | The database has not been migrated. A developer runs `npm run db:deploy`. |
| Import says "Could not find the header row" | Wrong file, or the Tasks sheet has no **Task ID** header. |
| Import says a column is missing | Check the four required column names are spelled as in §5.3. |
| A task appears twice | Its Task ID changed between imports. The old one is still there; tell a developer. |
| A client appears twice | Two spellings of the name. Check the workbook's Client column against the Clients list. |
| Overdue looks too high | Expected — see §2, item 3. Verify a few against the workbook. |
| Due dates are all one day out | Tell a developer, and say which timezone the machine is in. |
| Someone cannot sign in | Check the login is Active and not Locked under Clients & logins. Reset the password if needed. |
| Someone signs in to an empty dashboard | They have no clients granted. Open Manage access and grant some. The logins list flags this as "No access granted". |
| Someone cannot edit a task they should | Their grant for that client is *View only*. Switch it to *Can edit* on their access page. |
| A client vanished from someone's view | Either the grant was revoked, or the client was suspended — a suspended client drops out for everyone. |
| A figure on the dashboard disagrees with the register | It cannot — every figure is computed from the register on each load. Reload; if it persists, tell a developer. |

---

## 12. Do and don't

**Do**

- Keep updating the workbook. It is still the source of truth.
- Import whenever it changes. There is no cost to importing often.
- Set the import month to the month the register covers.
- Read the skipped-row list rather than ignoring it.
- Download the workbook at month end and keep it.

**Don't**

- Don't renumber Task IDs in the workbook.
- Don't add a client whose name differs from the workbook's spelling.
- Don't send a temporary password in the same message as the e-mail address.
- Don't share one login between people — the history is only useful if it names
  the person who made the change.
- Don't make someone CFOSME staff so they can see a few more clients. Grant the
  clients instead; staff can also change every client's data and read the audit log.
- Don't assume *Grant every client* keeps up with new clients. It does not.
- Don't assume an unfinished task is overdue. Check its due date.

---

## 13. For developers

Setup, architecture and the reasoning behind the data model are in
[`../README.md`](../README.md). Two commands are worth knowing:

```bash
npm run check                    # the register's rules, no database needed
npm run check:workbook -- <file> # parse a workbook and prove the round trip
```

`npm run check:workbook` reports what parsed, what resolved and what could not be
read, then writes the register back out, re-reads it, and requires every field of
every row to come back identical. Run it against a real workbook before trusting
a change to the importer or the export.

---

## 14. Change management

Anything that changes what a client sees — a schema change, a change to how a
figure is derived, a change to the importer — goes through a developer, is tested
against a real workbook with `npm run check:workbook`, and is checked on the
dashboard against the previous month's figures before anyone tells a client the
numbers have moved.

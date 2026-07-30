# Bind Build ERP

Studio Bind Architects · internal ERP.
Vite multi-page app + Supabase (Postgres, Auth, RLS), deployed on Vercel.

## Why an MPA and not Next.js

The 36-page prototype is hand-tuned HTML/CSS. Porting it to React would take
weeks and lose fidelity. Every page here is the **same markup** as the
prototype, so the UI is identical rather than recreated. The app sits behind a
login — no SEO, no public pages — so SSR buys nothing.

## Architecture

```
src/styles/app.css        design tokens + reset + app shell (was duplicated 36x)
src/styles/<page>.css     page-specific CSS only
src/lib/shell-template.js sidebar + topbar markup, auto-extracted
src/lib/shell.js          mounts shell, active nav, identity, theme, live counts
src/lib/auth.js           session + profile + roles, requireAuth() guard
src/lib/supabase.js       client
src/lib/ui.js             ₹ lakh/crore formatting, toasts, escaping
src/pages/<page>.js       per-page data wiring
tools/build-page.py       converts a prototype page -> Vite page
```

Add a page: `python3 tools/build-page.py <proto.html> <slug> "<Title>" <route>`
then write `src/pages/<slug>.js`. Vite picks up new root `.html` files
automatically — no config change.

## Status

| Page | Route | State |
|------|-------|-------|
| login | — | Live — password auth + reset |
| dashboard | dashboard | Live — pipeline by stage, activity feed, upcoming meetings |
| crm | crm | Live — kanban, drag persists stage, filters, realtime |
| lead | crm | Live — timeline, notes, meetings, file upload, won/lost |
| client | clients | Live — invoices, payment summary, record payment, GSTIN |
| proposal | sales | Live — line items, GST totals, autosave, send, view tracking |
| sales | sales | Live — funnel, weighted forecast, charts, CSV export |
| projects | projects | Live — cards, type/health filters, sort, create, CSV export |
| project | projects | Live — hero, KPIs, open tasks, milestones, recent DSRs |
| tasks | projects | Live — 5-column board, drag persists, filters, realtime |
| gantt | projects | Live — phases, bars, milestones, zoom, scroll-to-today |
| progress | site-visits | Live — planned vs actual S-curve, phase completion, photo gallery |
| dsr | site-visits | Live — labour, activities, materials, equipment, issues, submit |
| procurement | procurement | Live — PO table, pipeline, approvals queue, vendor spend |
| inventory | inventory | Live — stock balances, low/out alerts, movements, stock in/out |
| finance | finance | Live — KPIs, expense split, collected vs cost, ageing, project P&L |
| invoice | finance | Live — GST-split tax invoice, record payment, timeline, print |
| expenses | finance | Live — claims, approval workflow, category/mode breakdown |
| hr | hr | Live — roster with today's status, leave approvals, dept split, attendance trend |
| employee | hr | Live — profile, leave balances, documents |
| attendance | hr | Live — daily register, one-click marking, mark-all, ring |
| payroll | hr | Live — run processing, TDS entry, approve/disburse, CSV export |
| people | people | Live — kudos wall, celebrations |
| recruitment | hr | Live — candidate kanban, funnel, interviews, source mix |
| learning | hr | Live — catalogue, enrolment, progress, certifications, leaderboard |
| documents | documents | Live — folders, upload, signature queue, signed URLs |
| calendar | calendar | Live — month grid, agenda, unified feed |
| meetings | meetings | Live — list, detail, minutes, action items |
| client-portal | client-portal | Live — scoped projects, invoices, approvals, messaging |
| vendor-portal | vendor-portal | Live — scoped purchase orders, deliveries, messaging |
| analytics | analytics | Live — revenue, cost split, pipeline, sources, project table, insights |
| settings | settings | Live — org details, preferences, team roles, password, audit |
| profile | settings | Live — identity, activity, assigned tasks |
| notifications | settings | Live — feed, filters, mark read |
| help | settings | Live — searchable FAQ |
| assistant | settings | Live — answers from your data (see below) |

**All 36 pages are wired.**

Nav items for unconverted pages are dimmed and show a toast instead of a 404.
As each page lands, add its slug to `BUILT` in `src/lib/shell.js`.

## Database

Three migrations are already applied to the Supabase project:

1. `001_identity_and_access_foundation` — profiles, user_roles, 10-role enum,
   `has_role`/`is_staff`/`is_admin` SECURITY DEFINER helpers, signup trigger
2. `002_crm_and_sales` — clients, lead_notes, lead_files, meetings,
   proposal_items, sales_targets, lead_stage_config; leads/proposals extended
3. `003_harden_access_and_bootstrap_owner` — replaced permissive `USING (true)`
   policies with role-gated ones, added missing DELETE policies

Roles live in `user_roles`, never as a column on `profiles` — that is what
stops a user editing their own permissions.

`clients` carries GSTIN, PAN and state_code from day one. Place of supply
decides CGST+SGST vs IGST; adding it after invoices exist means rewriting
every finance query.

## Local development

```bash
npm install
cp .env.example .env    # optional — src/lib/config.js has working defaults
npm run dev
```

## Deploy

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
```

Or push to GitHub and import the repo at vercel.com — gives you CI/CD on
every commit, which is the better long-term setup.

Vercel needs no environment variables: `src/lib/config.js` falls back to the
project URL and publishable key. That key is public by design — it ships in
the client bundle regardless, and RLS is the security boundary. Never put the
`service_role` key in this repo.

## Adding a team member

```sql
-- after they sign up
insert into public.user_roles (user_id, role)
values ('<their-uuid>', 'site_engineer');
```

Valid roles: owner, admin, architect, site_engineer, procurement, accounts,
hr, sales, client, vendor.


## A note on function grants

Migration 003 tried to lock down internal functions with
`revoke execute ... from anon`. **That did nothing.** Postgres grants EXECUTE
to `PUBLIC` on every new function, and `anon` inherits it through `PUBLIC`.
Revoking from `anon` leaves the `PUBLIC` grant untouched.

Migration 008 fixes it by revoking from `PUBLIC` and granting back only where
needed. Current state:

| Function | anon | authenticated | Why |
|----------|------|---------------|-----|
| `get_proposal`, `log_proposal_view`, `update_view_seconds`, `accept_proposal` | yes | yes | Public proposal links — clients open these without an account |
| `is_staff`, `is_admin`, `has_any_role` | no | yes | RLS policies evaluate them as the calling role |
| `has_role`, `handle_new_user`, `touch_updated_at`, `sync_lead_stage`, `recalc_invoice_tax` | no | no | Trigger/internal only |

If you add a SECURITY DEFINER function, revoke from `PUBLIC`, not from `anon`.

## Money units — read this before touching finance code

Two different units are in play, deliberately:

- `leads.budget` and `sales_targets.target_value` are in **lakhs** (185 = ₹1.85 Cr).
  That came from the prototype and the proposal generator; changing it would
  break both.
- `invoices.*` and `proposal_items.*` are in **rupees**.

`crm.js` / `sales.js` use the lakh formatter; `client.js` / `proposal.js` use
the rupee one. Don't mix them.


## A note on FOR ALL policies

Migration 009 created write policies as `FOR ALL`, which **includes DELETE**,
then added a separate admin-only delete policy on `projects`. That admin policy
granted nothing: **RLS policies are PERMISSIVE and OR together**, so the
`FOR ALL` policy already allowed every delivery role to delete. A site engineer
could have deleted an entire project.

Migration 010 splits the grants explicitly. The rule: if you want DELETE to be
narrower than INSERT/UPDATE, you cannot use `FOR ALL` at all.

Current shape on the sensitive tables:

| Table | insert / update | delete |
|-------|-----------------|--------|
| `projects` | delivery roles | admin only |
| `site_reports` | delivery roles | own drafts, or admin |
| `invoices` | accounts roles | admin only |

Child tables (`tasks`, `site_report_*`, `schedule_items`, …) keep `FOR ALL`
deliberately — a site engineer removing a labour row is normal work.

## A submitted DSR is an audit record

`site_reports.status` goes `draft → submitted → approved`. Delivery roles can
delete only their own **drafts**; once submitted, deletion needs an admin. The
page disables the submit button after submission rather than letting a report be
edited silently.

## Project ↔ invoice link

`invoices.project_name` was free text when Finance schema landed in 005.
Migration 009 added `invoices.project_id` as a real FK. The text column is still
there for anything already written against it — backfill and drop it when
convenient:

```sql
update public.invoices i set project_id = p.id
from public.projects p
where i.project_id is null and i.project_name = p.name;
```

## Units, again

`projects.contract_value` is in **lakhs**, matching `leads.budget`.
`invoices.*` are in **rupees**. `projects.js` and `project.js` use the lakh
formatter; anything touching invoices uses rupees.


## Stock is a ledger, not a number

`materials` has no quantity column, deliberately. Quantities come from
`stock_ledger` — one row per movement — and `stock_balances` sums them:

```
stock_ledger (movements)  ->  stock_movements (signed qty)  ->  stock_balances
```

A mutable `qty` column drifts the moment two people record a movement at once,
and it destroys the audit trail: you can see the number is wrong but not why.
With a ledger, corrections are adjustment rows and history stays intact. That
is also why only admins can delete from `stock_ledger` — the fix for a bad
entry is an `adjust` movement, not a deletion.

`stock_balances` cross-joins materials against stores, so a material shows in
every active store with a zero balance until it moves. That is intentional:
"we hold none of this at Adyar" is real information.

## Getting Procurement and Inventory usable

Both pages read from empty tables until master data exists. Run
`supabase/seed/optional-material-catalogue.sql` in the SQL editor for a Chennai
construction catalogue (17 materials with HSN codes and reorder levels), a
central store, and a site store per active project. Adjust rates to your own
numbers — those are placeholders, not quotes.

Opening stock is commented out in that file on purpose. Enter counted
quantities rather than letting a script invent them.

## The page builder had three CSS bugs worth knowing about

`tools/build-page.py` extracts page CSS by removing anything already in
`app.css`. Three separate failures made that silently wrong:

1. **Only the first `<style>` block was read.** Pages 13–15 have two blocks and
   no section markers, so their real styles were dropped and the shared design
   system was copied in instead. Three different pages produced byte-identical
   CSS, which is what exposed it.
2. **Comments defeated deduplication.** The brace splitter attaches a leading
   `/* section header */` to the rule after it, so identical rules under
   different headers never matched.
3. **`@import url(...)` was split mid-URL.** Google Fonts URLs contain
   semicolons (`wght@400;500;600`), and the at-rule pattern stopped at the
   first one — leaving a fragment of a URL as the first line of valid CSS and
   gluing `:root` onto the tail.

Also: `:root` now emits only the tokens a page adds or overrides. Emitting the
whole block duplicated ~33 tokens per page and, worse, overrode `app.css` —
which would have silently broken the point of having one stylesheet.


## The record chain

Nothing downstream can attach to a lead, so the chain has to be walked in
order. Each step is now wired:

```
lead  --won-->  client  --invoice-->  payment
                  |
                  +--> project --> tasks / DSR / PO --> expense
```

- **Mark a lead won** and it offers to create the client record.
- **Client profile -> New invoice** numbers it by financial year (April start,
  Indian convention) and sets the GST split from the client's state code.
- **Invoice -> Record payment** appends to `invoice_payments`; the balance is
  derived, never stored.
- **Expense** starts as a claim from any staff member and needs accounts to
  approve, then mark paid.

Before this, a won lead was a dead end and no page could create an invoice.

## GST split is computed once, in the database

`invoices` and `purchase_orders` both carry an `is_interstate` flag and a
before-insert trigger that fills in CGST+SGST or IGST and the total. Pages send
only `subtotal`, `is_interstate` and the rates — they never compute tax. Two
implementations of a tax rule eventually disagree, and the one in the UI is the
one nobody tests.

Studio Bind is registered in Tamil Nadu, state code `33`. Same code on the
client means CGST+SGST; anything else means IGST.

## "Cash" on the finance dashboard is not a bank balance

There is no bank account table, so `kCash` shows **net cash movement** over the
selected window: payments received minus expenses marked paid. The label under
the chart says so. Do not reconcile it against a bank statement.


## Payroll: read this before running it live

**Verify the statutory numbers with your CA.** The rates and slabs shipped here
are starting values, not advice. They live in data, not code, so correcting them
is an UPDATE and not a deploy:

- `statutory_rates` — EPF 12%/12%, wage ceiling ₹15,000, ESI 0.75%/3.25%,
  ESI gross limit ₹21,000
- `pt_slabs` — Tamil Nadu (state code 33), Greater Chennai Corporation,
  half-yearly. Slabs change and corporations differ.

**TDS is not computed.** It needs annual income projection, old-vs-new regime
choice and Section 80 declarations. Guessing it creates real liability, so
`payslips.tds` is a field accounts fills in on the payroll page. The
`payslips_resync` trigger recomputes deductions and net pay when it changes,
so the arithmetic stays correct whoever edits it.

What the engine does compute, and how:

| Component | Basis |
|-----------|-------|
| EPF employee/employer | 12% of basic, basic capped at the wage ceiling |
| ESI employee/employer | 0.75% / 3.25% of gross, only at or below the gross limit |
| Professional tax | TN half-yearly slab ÷ 6 |
| Loss of pay | Approved unpaid leave inside the month, pro-rated on calendar days |

Worked example (July 2026, 31 days, basic 45,000 + HRA 22,500 + allowance 22,500):

```
gross            90,000
PF employee       1,800   (15,000 ceiling x 12%, not 45,000 x 12%)
ESI                   0   (gross above the 21,000 limit)
professional tax    208.33 (1,250 half-yearly / 6)
net              87,991.67
```

`generate_payroll()` is SECURITY INVOKER on purpose: the caller's RLS decides
whether they may read salaries and write payslips. It refuses to regenerate a
run that is no longer a draft, so an approved month cannot be quietly rebuilt.

## Statutory identity is a separate table

`employee_statutory` holds PAN, Aadhaar last four, UAN, ESIC number and bank
details, keyed one-to-one on `employees`. It exists because **RLS is row-level,
not column-level** — anyone who can read the `employees` row can read every
column of it. Splitting the sensitive fields into their own table is the only
way to let staff see the team roster while keeping identity documents to HR and
the employee themselves.

Aadhaar is stored as the last four digits only, with a check constraint. Full
Aadhaar numbers should not be in an application database.

## Leave balances are derived

`leave_balances` is a view: annual quota from `leave_types`, minus approved days
this calendar year. Same reasoning as stock and invoice balances — a stored
balance column drifts the first time a request is edited or cancelled.


## The stray-closing-tag bug

Symptom: the shell rendered correctly but page content collapsed into
unstyled stacked text, even though the page stylesheet loaded fine and
contained every rule.

Cause: the prototype closes its own wrappers after `</main>`:

```
</main>
<footer>...</footer>      <- still inside .main
</div>                    <- closes .main
</div>                    <- closes .app
<div class="modal">...    <- outside .app
```

`build-page.py` emits those two closers itself, so keeping the prototype's
copies produced **two stray `</div>` tags**. The browser closed `.content` and
`.main` early and hoisted the rest of the page out of the layout containers,
so every grid and card rule stopped matching. CSS was never the problem, which
is why the file looked complete.

The first fix stripped leading `</div>` with a regex and did nothing at all,
because the footer comes first. `after_main()` now walks the tail tracking tag
depth, treats each unmatched closer as a wrapper boundary the template already
owns, and returns two parts: content that belongs inside `.main` (the footer)
and content that belongs outside `.app` (modals).

`tools/check-pages.py` asserts every generated page is balanced. Run it after
regenerating.


## Portal scoping

The portals are the first place someone outside the studio gets a login, so
scoping is the entire job. It is enforced with row level security on the
**existing** tables, never by filtering in page code:

```sql
create policy "client reads own projects" on projects for select
  using (client_id = public.my_client_id());
```

`my_client_id()` reads `client_users` for the current session. For anyone who
is not a portal user it returns NULL, and `client_id = NULL` evaluates to NULL,
which RLS treats as false. **It fails closed** — a missing link shows nothing
rather than everything. That was verified rather than assumed.

Documents are the one thing that is not scoped automatically: a client sees a
document only when `shared_with_client` is explicitly true. Sharing a project
folder wholesale would eventually leak an internal cost sheet.

To give a client access:

```sql
-- after creating their auth user
insert into public.client_users (user_id, client_id) values ('<uuid>', '<client uuid>');
insert into public.user_roles  (user_id, role)      values ('<uuid>', 'client');
```

## The assistant is not a language model

It runs real queries against your data — pipeline value, receivables ageing,
thin-margin projects, what is due this week, low stock, who is in today — and
reports what it finds.

An LLM needs an API key, and **a key in a browser bundle is a key you have
published**: anyone can read it in devtools and spend your credits. Doing it
properly means a Supabase Edge Function holding the secret and proxying the
call, so the browser never sees it. Until that exists, honest queries beat a
chat box that invents numbers.

## Nav counts

The prototype hardcoded badges (Projects 12, Procurement 3). Those are now
real counts — open leads, active projects, POs awaiting approval — and a badge
with nothing to show is hidden rather than displaying a stale number. A number
that lies is worse than no number.


## Fidelity audit

`tools/audit.py` compares every generated page against the prototype it came
from and answers three questions:

| Check | What it catches |
|-------|-----------------|
| lostUI | ids in the prototype's `<main>` that never made it into our page |
| deadCtrl | buttons, inputs and selects the page renders that no module references |
| noCSS | classes used with no matching selector in `app.css` + the page stylesheet |

Run it after regenerating pages:

```bash
python3 tools/audit.py
python3 tools/check-pages.py
```

Current state: **0 lost UI, 0 dead controls, 8 CSS gaps** — and all 8 are
`.cup`, `.di` and `.hfact`, which the prototypes never styled either. They are
reproduced faithfully rather than invented.

The first run found **40 dead controls**. Every one was a designed dialog that
had been bypassed with `window.prompt`: add-lead, mark-lost, task edit, schedule
meeting, record payment, send proposal. Prompts work, but they discard the
design and every field it defines — type, options, validation, placeholder. All
six flows now drive the prototype's own markup.

Two things worth knowing about those dialogs:

- The task dialog offers a column called `progress`; the database enum uses
  `doing`. The page maps between them rather than widening the enum, because
  the enum name is the one the rest of the schema references.
- Sending a proposal opens WhatsApp or the mail client with the message and
  link prefilled. No mail server is configured, and silently doing nothing
  while showing "Sent" would be worse than handing off.

## Changing a password verifies the old one

`supabase.auth.updateUser({ password })` does **not** check the current
password — an unlocked laptop would be enough to take over an account. Settings
re-authenticates with the current password first, then updates.


## Is this production-ready?

The **schema and code are production-grade**. The **operational setup is not**.
They are different things, and the gap is where data gets lost.

### What is genuinely solid

- 80 tables, every one with RLS enabled and at least one policy
- Role-based access through SECURITY DEFINER helpers, verified to fail closed
- Ledger patterns where they matter: stock movements, invoice payments, leave,
  salary structures. Balances are derived, never stored twice
- GST and payroll computed in the database, so the UI cannot disagree with it
- Statutory identity isolated in its own table
- 0 lost UI, 0 dead controls, verified by `tools/audit.py`

### What is not ready, honestly

| Gap | Risk | Fix |
|-----|------|-----|
| **Free plan: zero backup retention** | Total data loss, unrecoverable | Upgrade to Pro, and run `tools/backup/backup.sh` regardless |
| **Free plan pauses after ~7 days idle** | ERP offline until manually restored | Pro removes pausing entirely |
| **No automated tests** | Regressions ship silently | Start with the payroll engine and GST triggers |
| **Invoices stay editable after issue** | GST non-compliance | Lock on status change; correct via credit note |
| **Hard deletes everywhere** | GST records must be retained ~6 years | Add `deleted_at` and filter in policies |
| **No error monitoring** | Failures only visible in the console | Sentry or Supabase log drains |
| **Statutory rates unverified** | Wrong PF/ESI/PT deductions | CA review before live payroll |
| **TDS not computed** | Deliberate — needs declarations | Accounts enters it per payslip |

### Verdict

Safe to run **your own studio's live data on**, provided you upgrade to Pro and
take backups. Not yet safe to sell to other firms, or to rely on for a
statutory audit, until invoice immutability, soft deletes and tests exist.

## Backups

The Free plan keeps **zero days of backup retention**. Supabase's own
documentation tells free-tier projects to export their own data and keep
off-site copies. Nothing is being snapshotted for you.

A complete backup needs three separate things, because they live in three
different places:

| Store | Contains | Captured by |
|-------|----------|-------------|
| Postgres `public` | all 80 tables of business data | `pg_dump` |
| Postgres `auth` | logins — **not** in a public-schema dump | `pg_dump --table=auth.users` |
| Storage buckets | lead files, site photos, receipts, documents | Supabase CLI |

A dump of `public` alone restores your data with **nobody able to log in**, and
every file link broken. That is the mistake worth avoiding.

```bash
export SUPABASE_DB_URL="postgresql://postgres.[ref]:[pw]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
export SUPABASE_PROJECT_REF="eyfccifvzhdgjrhnxsrm"
./tools/backup/backup.sh
```

Restore into a **new** project, never over the damaged one:

```bash
export TARGET_DB_URL="postgresql://postgres.[newref]:[pw]@..."
./tools/backup/restore.sh backups/2026-07-30_1400.tar.gz
```

Schedule it weekly, and **test a restore once** before you need one. An
untested backup is a hope, not a backup.

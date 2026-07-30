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
| 26–36 | — | Prototype ready, not yet converted |

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

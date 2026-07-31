# Extending Bind Build ERP

How to add things without breaking what works. Two rules cover most of it.

## Rule 1 — add dimensions, never rewrite tables

When something new needs to be tracked, add a **nullable** column with a
sensible default and backfill it. Never add `NOT NULL` to a populated table,
and never rename a column another app might read.

This is how business units were added in migration 023:

```sql
alter table public.invoices
  add column business_unit_id uuid references public.business_units(id);

update public.invoices set business_unit_id = (
  select id from public.business_units where is_default);
```

Existing rows stayed valid, every existing query kept working, and the new
dimension became opt-in. The proposal generator, which knows nothing about
business units, never noticed.

The same rule is why `leads` still has both `stage` (legacy smallint) and
`stage_key` (enum), kept in step by a trigger. Two apps read that table; only
one of them is this one.

## Rule 2 — put behaviour in the database when correctness matters

If a rule must always hold, it belongs in Postgres, not in page JavaScript.
The UI is the copy nobody tests.

Already done this way:

| Rule | Where |
|------|-------|
| GST split, intra vs inter state | `invoices_recalc` trigger |
| PF / ESI / professional tax | `generate_payroll()` |
| Issued invoices are immutable | `invoices_zz_lock` trigger |
| Credit notes cannot exceed the invoice | `cn_limit` trigger |
| Stock balance | `stock_balances` view over a ledger |
| Leave balance | `leave_balances` view |
| Who can see what | 220 RLS policies |

Put it in a page instead and you get two implementations that eventually
disagree, with the wrong one facing the client.

---

## Adding a new vertical

A vertical is either a service line under the same GSTIN, or a separate legal
entity. `business_units` covers both.

```sql
-- shares the studio's GST registration
insert into public.business_units (code, name, invoice_prefix, proposal_prefix)
values ('LAND', 'Landscape', 'LND', 'LND');

-- or invoices independently
insert into public.business_units
  (code, name, legal_name, gstin, pan, state_code, invoice_prefix)
values ('REALTY', 'Bind Realty', 'Bind Realty LLP',
        '33XXXXX1234X1ZX', 'XXXXX1234X', '33', 'BR');
```

Each unit numbers its own invoices, so series never collide — which matters,
because GST expects an unbroken sequence per registration.

What you get for free: every `leads`, `clients`, `projects`, `proposals`,
`invoices`, `credit_notes`, `purchase_orders`, `expenses` and `employees` row
can carry a unit, and reports can group by it.

The picker and scoping are built. `shell.js` exports:

```js
activeUnit()            // the selected unit id, or null
activeUnitName()        // for display
scopeToUnit(query)      // adds a unit filter to a Supabase query
```

The topbar selector appears **only once a second unit exists** — a dropdown
with one option is noise. Choice persists in `localStorage` and reloads the
page, which is the simplest correct way to refresh every query at once.

`scopeToUnit()` matches the active unit **or null**, so records created before
units existed stay visible instead of silently vanishing.

Wired so far: leads, projects, clients, invoices, expenses, purchase orders.

Still to do when you actually launch a second unit:

1. Invoice numbering should read the unit's `invoice_prefix` rather than the
   fixed `INV-`. Matters most if the unit has its own GSTIN, because GST
   expects an unbroken series per registration.
2. Reports (`analytics`, `finance`) do not group by unit yet.

## Adding a proposal type

`proposal_templates` describes how a proposal is structured and priced, so a
new type is a row rather than a branch in page code.

```sql
insert into public.proposal_templates
  (code, name, pricing_model, sections, default_scope, default_terms, default_schedule)
values
('LANDSCAPE', 'Landscape design', 'per_sqft',
 '[{"key":"softscape","label":"Softscape","type":"table"},
   {"key":"hardscape","label":"Hardscape","type":"table"},
   {"key":"irrigation","label":"Irrigation","type":"list"},
   {"key":"schedule","label":"Payment schedule","type":"schedule"}]'::jsonb,
 E'Site survey and planting plan\nHardscape detailing\nIrrigation layout',
 E'Plant material is guaranteed for 90 days.\nGST at 18% is extra.',
 '[{"n":"Design","p":30},{"n":"Planting","p":50},{"n":"Handover","p":20}]'::jsonb);
```

Four ship already: `TURNKEY` (per sq ft, stage-wise), `INTERIOR` (room-wise),
`CONSULT` (hourly), `RENOV` (stage-wise).

`pricing_model` values: `lump_sum`, `per_sqft`, `per_unit`, `hourly`,
`stage_wise`, `room_wise`, `percentage_of_cost`.

The `sections` array is what the editor renders, in order. Section types are
`list`, `table` and `schedule`, and `proposal.js` renders all three — a new
proposal type needs no page changes at all.

Content lives in `proposals.sections_data`, keyed by section:

```json
{"exclusions": ["Civil work", "Electrical rough-in"],
 "specs": [{"c": ["Flooring", "600x600 vitrified"]}]}
```

One jsonb column rather than a table per section type, because sections are
document prose — nobody will filter projects by "exclusions". The two sections
that *are* queried keep their own homes: the fee table in `proposal_items` and
the payment schedule in `proposals.stages`, because `get_proposal()` exposes
both to unauthenticated client links and a live proposal URL must not break.

A `proposals_apply_template` trigger fills scope, terms, schedule, tax rate and
validity from the template on insert — but only where the field is still empty,
so it never overwrites what someone wrote. Switching template in the editor
follows the same rule.

## Adding a whole module

Follow what the existing eight did:

1. **Migration first.** Tables, enums, RLS on every table, at least one policy
   per command. Split DELETE out if it should be narrower than INSERT/UPDATE —
   `FOR ALL` includes DELETE and policies OR together, which has bitten this
   codebase once already.
2. **Generate the page.**
   `python3 tools/build-page.py <proto.html> <slug> "<Title>" <route>`
3. **Write `src/pages/<slug>.js`.** Call `mountShell({route, title})` first; it
   returns the identity or redirects.
4. **Register the route** in `BUILT` in `src/lib/shell.js`, or the nav shows a
   "not wired" toast.
5. **Audit.** `python3 tools/audit.py` and `python3 tools/check-pages.py`.
   Zero lost UI, zero dead controls, zero unbalanced tags.

## Things that will bite

**Money units.** `leads.budget`, `sales_targets.target_value` and
`projects.contract_value` are in **lakhs**. Everything else — invoices,
expenses, purchase orders, payroll — is in **rupees**. Mixing them is a factor
of 100,000. `project_financials` converts once, in the view.

**`CREATE OR REPLACE VIEW` can only append columns.** It cannot reorder or drop
them. A view built on `select t.*` freezes its column list at creation, so
adding a column to the table does not reach the view. Drop and recreate.

**Trigger order is alphabetical.** `invoices_zz_lock` is named that way to fire
after `invoices_recalc`. If you add a trigger that must run last, name it so.

**Revoking from `anon` does nothing.** Postgres grants `EXECUTE` to `PUBLIC` on
every new function and `anon` inherits it. Revoke from `PUBLIC`, then grant
back what is needed.

**RLS policies are permissive and OR together.** A `FOR ALL` write policy
alongside an admin-only DELETE policy does not restrict deletes. To make DELETE
narrower, split the grants. To *subtract* rows, use `AS RESTRICTIVE` — that is
how soft-deleted rows are hidden without touching 220 existing policies.

**Nineteen tables cannot be hard-deleted.** `DELETE` is revoked from
`authenticated`. Use `soft_delete(table, id, reason)`. If you add a statutory
table, add it to the retained list in migration 021 and to the allow-list
inside `soft_delete()`.


## Adding a backup destination

Nothing to code. `rclone config`, then add the remote to `BACKUP_REMOTES`:

```bash
export BACKUP_REMOTES="gdrive:BindBuild onedrive:BindBuild s3:bindbuild-backups"
```

Resist writing a provider integration. Every cloud changes its auth eventually,
and each one you hand-roll is a thing you maintain forever.

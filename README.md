# Bind Build ERP

Internal operations ERP for **Bind Builds** and **Studio Bind Architects**.

- Frontend: Vite multi-page HTML/CSS/JavaScript
- Backend: Supabase Postgres + Auth + RLS + Storage + Cron
- Hosting target: Vercel
- Runtime: **Node.js 22+**
- Supabase project: `glywgbhuqrfxgowovylo`

## Operating flow

The current ERP connects the full operating chain:

`Lead → Estimate → Proposal → Client → Project → Preconstruction → Design → Construction → Site QA/DSR → Procurement/Inventory → Finance → HR/Payroll → Documents/MOM → Client/Vendor Portals → Analytics`

Core commercial documents use controlled numbering:

- Lead: `BB-YY-####`
- Project: `BB-P-YY-####`
- Estimate: `EST-YY-####`
- Proposal: `PRO-YY-####`
- Proforma: `PI-FY-####`
- Receipt: `REC-FY-####`
- GST Invoice: `INV-FY-####`
- Credit Note: `CN-FY-####`
- Material Requisition: `MR-YY-####`
- Purchase Order: `PO-YY-####`
- Goods Receipt: `GRN-YY-####`
- Vendor Bill: `VB-FY-####`
- Employee: `EMP-YY-####`
- Payroll: `PAY-FY-####`
- Reimbursement: `REIMB-FY-####`
- Project Document: `DOC-YY-####`
- MOM: `MOM-YY-####`

## Main application areas

- **Sales:** CRM, lead detail, estimates, proposals and conversion.
- **Projects:** project register, preconstruction, design, construction stages, tasks, progress and site reporting.
- **Supply:** materials, requisitions, RFQs, vendor quotes, purchase orders, GRNs and stock ledger.
- **Finance:** proformas, receipts, GST invoices, credit notes, expenses, vendor bills/payments and period locks.
- **People:** employee master, attendance, leave, project allocation, payroll, reimbursements, KPI goals/reviews and kudos.
- **Workspace:** controlled project documents/revisions, approvals, meetings, minutes, decisions and task-linked actions.
- **External portals:** RLS-isolated Client Portal and Vendor Portal using email magic-link access.
- **Management:** Founder Dashboard, Analytics, per-user operational alerts, backup/restore and scheduled daily scans.

## Security model

Browser code uses the Supabase publishable key only. **Never commit a service-role key or database password.**

Authorization is enforced primarily through Postgres RLS and role-aware database functions. External portal accounts are mapped through `portal_memberships`; an authenticated email without an active membership cannot see client/vendor ERP records.

The private document bucket is `erp-documents`. Client access is limited to the current approved revision of documents explicitly marked client-visible.

## Database reproducibility

Authentic migration history is mirrored under `supabase/migrations/`.

Current recorded migrations:

1. `20260920190918_erp_foundation_numbering.sql`
2. `20260920191039_core_erp_schema.sql`
3. `20260920191131_security_finance_integrity.sql`
4. `20260922233302_analytics_backup_automation_controls.sql`

Because several major modules were originally expanded through direct live DDL before migration-history cleanup, the repository also contains a consolidated live-schema bootstrap:

`supabase/baseline/current_schema.sql`

The machine-readable release inventory is:

`supabase/release-manifest.json`

At the 2026-09-23 audit the live project contained:

- 78 public tables
- 115 public/private functions
- 67 active public user triggers
- 261 public/storage RLS policies
- private `erp-documents` Storage bucket
- active `bindbuild-daily-ops-scan` Cron job

The CI release gate checks the repository baseline against this inventory. A destructive **fresh-project bootstrap execution test** is still required before treating the consolidated baseline as independently proven on a new project.

## Backup and disaster recovery

Open **Backup & Operations** in the ERP.

Founder/Admin can:

- export application data as a versioned JSON backup;
- validate a backup before restore;
- restore only into an operationally empty, Auth-compatible target;
- export actual private document bytes as a ZIP;
- restore Storage ZIPs non-destructively and resume partial restores;
- verify CRC32 checksums;
- run a read-only Storage integrity audit comparing database revision paths against bucket objects.

Application JSON does **not** include Auth credentials/sessions, Storage file bytes, secrets or hosting configuration. Keep the application JSON and documents ZIP together.

For platform-level disaster recovery, use Supabase platform/CLI database backups in addition to the in-app recovery layer.

## Automation

Supabase Cron runs `bindbuild-daily-ops-scan` at **02:30 UTC / 08:00 IST**.

It creates deduplicated internal alerts for overdue tasks, overdue client invoices, overdue vendor bills, approvals waiting more than 48 hours and low site stock.

Notification read state is stored per ERP user.

## Local development

Requirements:

- Node.js 22+
- npm

```bash
npm ci
npm run dev
```

Production-equivalent local check:

```bash
npm run build
```

`npm run build` always runs the repository QA release gate first.

## CI

GitHub Actions runs on Node 22 and executes:

```bash
npm ci
npm run build
```

QA checks include route/assets, local imports, browser secret scanning, exact dependency pinning, Vercel build command, Supabase baseline/release-manifest consistency, migration mirror consistency, forbidden direct `storage.objects` SQL mutations and Storage ZIP checksum regression.

## Vercel

`vercel.json` requires `npm run build`, so QA cannot be bypassed by deployment.

Before production cutover:

1. link the Vercel project to **this repository**;
2. use Node 22;
3. confirm Supabase URL/publishable key configuration;
4. add deployed Client/Vendor Portal URLs to the Supabase Auth redirect allowlist;
5. run the release checklist in `RELEASE_CHECKLIST.md`.

## Important

Do not merge the integration branch only because the UI builds. Production release also requires clean GitHub CI, Supabase advisor review, clean Storage integrity audit, fresh backups and the remaining fresh-project baseline boot test.

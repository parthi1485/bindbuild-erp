# Bind Build ERP — Production Release Checklist

Use this checklist for the integration branch before production cutover.

## Code and build

- [ ] Pull request is mergeable and has no unresolved conflicts.
- [ ] GitHub ERP CI is green on the current head SHA.
- [ ] Runtime is Node 22+.
- [ ] `npm ci` succeeds from the committed lockfile.
- [ ] `npm run build` passes QA and Vite production build.
- [ ] No browser bundle contains service-role/database/API secrets.
- [ ] Vercel uses `npm run build`.

## Supabase schema

- [ ] Recorded live migration versions equal `supabase/release-manifest.json`.
- [ ] Consolidated baseline passes the repository inventory gate.
- [ ] Security Advisor reviewed; no new release-blocking findings.
- [ ] Performance Advisor reviewed; remaining warnings are documented.
- [ ] Fresh-project baseline bootstrap execution test completed before claiming zero-to-live reproducibility.
- [ ] Auth redirect allowlist contains the production Client and Vendor Portal URLs.
- [ ] Leaked-password protection decision reviewed in Supabase Auth settings.

## Backup / recovery

- [ ] Download a fresh application JSON backup.
- [ ] Download a matching `erp-documents` ZIP backup.
- [ ] Run Document Storage integrity audit and resolve every missing/orphan/size mismatch.
- [ ] Store both backup files outside the Supabase project.
- [ ] Record the backup date and release commit SHA.
- [ ] Periodically test restore on an isolated non-production project.
- [ ] Keep platform/CLI database backup procedures separately documented; in-app JSON/ZIP is not a full platform backup.

## Functional smoke test

- [ ] Login / reset password.
- [ ] Lead → Estimate → Proposal → Accepted conversion.
- [ ] Client / Project creation.
- [ ] Proforma → Receipt → GST Invoice.
- [ ] Credit note / finance controls.
- [ ] Preconstruction / Design / Construction.
- [ ] DSR / QA / progress.
- [ ] MR → RFQ → Quote → PO → GRN → Stock → Vendor Bill → Payment.
- [ ] Employee → Attendance → Leave → Payroll → Reimbursement.
- [ ] Controlled Document R0/R1 issue + approval.
- [ ] Meeting → Decision → Action → linked Project Task.
- [ ] Task Board create/edit/drag status + deep link.
- [ ] Calendar consolidates meetings, tasks, inspections, milestones and approved leave.
- [ ] Client Portal isolation + shared document open + approval.
- [ ] Vendor Portal isolation + RFQ quote + PO/bill visibility.
- [ ] Analytics / Founder Dashboard.
- [ ] Per-user operational notifications.
- [ ] Backup validation + Storage ZIP checksum validation.

## Deployment

- [ ] Vercel project is linked to `parthi1485/bindbuild-erp`, not the retired simplified repo.
- [ ] Production branch/ref is intentional.
- [ ] Supabase publishable key only is exposed to browser code.
- [ ] Production deployment URL opens Login correctly.
- [ ] No page opens halfway down due to retained scroll state.
- [ ] Client/Vendor magic-link redirect returns to the correct production portal.
- [ ] Mobile login, dashboard, CRM, project and portal routes checked on iPhone.

## Cutover

- [ ] Take final pre-release JSON + Storage ZIP backup.
- [ ] Merge only after CI and conflict state are clean.
- [ ] Deploy production.
- [ ] Run smoke test against production.
- [ ] Keep prior stable deployment available for rollback.

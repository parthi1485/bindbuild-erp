# Bind ERP — RDash Reverse-Engineering Migration Map

Date: 2026-09-29  
Branch: `feature/new-supabase-foundation`  
Repository: `parthi1485/bindbuild-erp`

## Objective

Keep the working Supabase/RLS/business-rule foundation, but reorganise the ERP around a construction operating model:

`Lead → Proposal → Project → BOQ → Plan → Procurement → Site Execution → Billing → QC/Snags → Handover → P&L`

The UI target is deliberately simpler than RDash: eight primary navigation destinations, contextual project tabs, role-specific dashboards, and progressive disclosure.

## Current state found in the repository

The branch already contains a substantial working ERP:

- Sales conversion and controlled commercial numbering
- Projects and pre-construction
- Design deliverables and drawing register
- 16-stage construction control
- DSR, inspections, quality checks and site issues
- Procurement, PO, GRN, inventory, vendor bills/payments
- Client billing, receipts, GST invoices and credit notes
- HR, attendance, payroll and people/performance
- Documents, meetings, tasks and calendar
- Client/vendor portals
- Analytics, alerts and backup/restore
- Supabase Auth, RLS and database-enforced state transitions

Important architectural gap: the project does **not yet use a central BOQ/scope object as the common link between schedule, procurement, measured execution, billing, variations and project margin**. This is the main RDash concept to introduce.

## Target primary navigation

1. **Home**
2. **Sales**
3. **Projects**
4. **Site**
5. **Procurement**
6. **Finance**
7. **People**
8. **Reports**

Settings/profile/help/backup become account/system utilities, not primary modules. Client and vendor portals remain separate external experiences.

## Current screen migration map

| Current route | Decision | Target |
|---|---|---|
| dashboard.html | REDESIGN | Home command centre |
| assistant.html | MERGE | Contextual Bind AI in Home + project pages |
| analytics.html | MERGE | Reports |
| crm.html | KEEP + REDESIGN | Sales pipeline |
| lead.html | MERGE | Sales → Lead detail |
| client.html | MERGE | Sales → Clients |
| sales.html | MERGE | Sales overview/commercial register |
| estimate.html | KEEP AS DETAIL | Sales → Estimate |
| proposal.html | KEEP AS DETAIL | Sales → Proposal |
| projects.html | KEEP + REDESIGN | Projects register |
| project.html | MAJOR REDESIGN | Project Hub |
| design.html | MERGE | Project Hub → Design |
| gantt.html | MERGE | Project Hub → Plan |
| progress.html | MERGE | Project Hub / Site → Execution |
| dsr.html | KEEP + REDESIGN | Site → Daily Report |
| procurement.html | KEEP + REDESIGN | Procurement workspace |
| inventory.html | MERGE | Procurement → Stores |
| purchase-order.html | KEEP AS DETAIL | Procurement → PO document |
| grn.html | KEEP AS DETAIL | Procurement → GRN |
| finance.html | KEEP + REDESIGN | Finance |
| expenses.html | MERGE | Finance → Expenses |
| proforma.html | KEEP AS DETAIL | Finance → Proforma |
| invoice.html | KEEP AS DETAIL | Finance → GST Invoice |
| receipt.html | KEEP AS DETAIL | Finance → Receipt |
| credit-note.html | KEEP AS DETAIL | Finance → Credit Note |
| hr.html | MERGE | People |
| people.html | MERGE | People |
| employee.html | KEEP AS DETAIL | People → Employee |
| attendance.html | MERGE | People → Attendance |
| payroll.html | MERGE | People → Payroll |
| recruitment.html | MERGE | People → Hiring |
| documents.html | MERGE | Project Hub → Files / controlled documents |
| meetings.html | MERGE | Project Hub / Home → Meetings |
| tasks.html | MERGE | Home + contextual project actions |
| calendar.html | MERGE | Home / People calendar |
| notifications.html | MERGE | Global notification centre |
| client-portal.html | KEEP + REDESIGN | External Client Portal |
| vendor-portal.html | KEEP + REDESIGN | External Vendor Portal |
| settings.html | KEEP | System utility |
| backup.html | KEEP | System utility |
| profile.html | KEEP | Account utility |
| help.html | REMOVE FROM PRIMARY UI | Support utility only |
| learning.html | REMOVE FROM PRIMARY UI | Future knowledge centre |
| login.html | KEEP + SIMPLIFY | Authentication |
| index.html | KEEP | Route/bootstrap |

The goal is **not to delete working capabilities**. It is to remove navigation noise and relocate features into the correct operating context.

## Target Project Hub

Every project becomes the central operational workspace.

Primary tabs:

- **Overview**
- **Scope**
- **Plan**
- **Site**
- **Money**
- **Files**

### Overview
Only the information needed to act:

- contract / revised contract
- physical progress
- executed value
- billed
- collected
- outstanding
- forecast cost/margin
- schedule variance
- approvals waiting
- open critical issues
- current stage
- next important actions

### Scope
New BOQ backbone:

`BOQ → BOQ Item → Budget → Procurement → Execution → QC → Billing → Variation → Margin`

### Plan
- project stages
- activities
- dependencies
- milestones
- planned/actual dates
- drawing/design dependencies
- blockers
- Gantt as an advanced view, not default UI

### Site
- Today's work
- DSR
- measurements
- manpower
- materials received
- inspections
- QC
- issues / RFI
- snagging
- photos

### Money
- contract
- approved changes
- budget
- commitments
- actual cost
- executed value
- client billing
- collections
- vendor liabilities
- retention
- forecast final cost
- forecast gross margin

### Files
- current AFC drawings
- drawing history/revisions
- specifications
- approvals
- contracts
- MOM
- site documents
- handover documents

## New core domain required

### BOQ

Proposed minimum tables:

- `boqs`
- `boq_versions`
- `boq_sections`
- `boq_items`
- `boq_item_rates`
- `boq_measurements`
- `boq_progress`

Each BOQ item should be able to link to:

- project
- specification
- schedule activity
- material/BOM requirement
- MR / PO / PO item
- DSR measured quantity
- inspection / QC
- client bill item
- vendor bill item
- change order
- snag
- cost code

### Change management

New domain:

- `change_orders`
- `change_order_items`
- `change_order_approvals`

Workflow:

`Draft → Internal Review → Client Approval → Approved → Executed → Billed → Paid`

An approved change must update revised contract value and preserve the original BOQ baseline.

### Schedule

Current weighted construction stages stay, but become the high-level WBS.

Add activity-level scheduling beneath them:

- `schedule_activities`
- `schedule_dependencies`
- `schedule_updates`
- `project_milestones`

### Cost control

Introduce consistent project cost codes and item-level project financials.

Required outputs:

- original contract
- approved variations
- revised revenue
- original budget
- revised budget
- committed cost
- actual cost
- cost to complete
- forecast final cost
- forecast gross profit
- forecast margin
- unbilled executed value
- receivables
- payables

## Existing modules to preserve

Do **not** throw away the current database-enforced controls for:

- GST logic
- document numbering
- finance period locking
- immutable issued financial documents
- receipt/invoice correction controls
- construction stage approval gates
- inspection/QC gates
- DSR locking and approval
- procurement approval hierarchy
- stock ledger
- over-receipt/over-billing/over-payment checks
- payroll/leave controls
- RLS portal isolation
- backup/recovery

These are valuable foundations. The redesign should sit on top of them.

## Phase 1 build order

### 1. Navigation and information architecture
Reduce the current sidebar to the eight primary destinations without deleting routes.

### 2. Project Hub shell
Refactor `project.html` into:
`Overview | Scope | Plan | Site | Money | Files`

First pass can embed/read existing module data before database changes.

### 3. BOQ foundation
Add BOQ migrations, RLS, audit trail and versioning.

### 4. Link procurement to BOQ
MR/PO/GRN remain intact, but PO lines gain optional `boq_item_id` / cost-code linkage.

### 5. Link DSR/measurements to BOQ
Recorded site quantities update installed/executed quantities after approval.

### 6. Link billing to BOQ
Client billing and vendor cost become quantity/value traceable against the same scope item.

### 7. Change orders
Add controlled scope/cost/time changes with client approval.

### 8. Project P&L
Build item-level budget vs committed vs actual vs forecast.

### 9. Client Portal refinement
Expose progress, approved changes, approvals, billing, documents and snags only.

### 10. Bind AI
AI becomes a read/action layer over the structured system, not a standalone page.

## First engineering milestone

Before touching the working financial/procurement logic:

1. Simplify sidebar.
2. Build the new Project Hub information architecture.
3. Add BOQ schema in additive migrations only.
4. Preserve all existing data and routes.
5. Introduce nullable foreign-key links first.
6. Add DB enforcement only after compatibility/backfill checks.
7. Run existing QA + CI after every migration.

## Release constraint

Do not cut over production yet. Current hardened work is in `parthi1485/bindbuild-erp`, while the previously noted active Vercel production project was linked to `parthi1485/bindbuild-erp-v2`. Keep the redesign on the integration branch until the repository/deployment source is intentionally reconciled.

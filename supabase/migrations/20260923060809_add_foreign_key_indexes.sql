-- Add covering indexes for public foreign keys flagged by Supabase performance advisor.
-- Applied to live Bind Builds ERP project as migration 20260923060809.

create index if not exists approvals_decided_by_idx on public.approvals (decided_by);
create index if not exists clients_business_unit_id_idx on public.clients (business_unit_id);
create index if not exists credit_notes_business_unit_id_idx on public.credit_notes (business_unit_id);
create index if not exists credit_notes_client_id_idx on public.credit_notes (client_id);
create index if not exists credit_notes_project_id_idx on public.credit_notes (project_id);
create index if not exists estimates_business_unit_id_idx on public.estimates (business_unit_id);
create index if not exists estimates_client_id_idx on public.estimates (client_id);
create index if not exists estimates_lead_id_idx on public.estimates (lead_id);
create index if not exists estimates_project_id_idx on public.estimates (project_id);
create index if not exists expenses_business_unit_id_idx on public.expenses (business_unit_id);
create index if not exists expenses_vendor_id_idx on public.expenses (vendor_id);
create index if not exists invoices_business_unit_id_idx on public.invoices (business_unit_id);
create index if not exists invoices_lead_id_idx on public.invoices (lead_id);
create index if not exists invoices_proforma_id_idx on public.invoices (proforma_id);
create index if not exists leads_business_unit_id_idx on public.leads (business_unit_id);
create index if not exists leads_owner_id_idx on public.leads (owner_id);
create index if not exists proforma_invoices_business_unit_id_idx on public.proforma_invoices (business_unit_id);
create index if not exists proforma_invoices_client_id_idx on public.proforma_invoices (client_id);
create index if not exists proforma_invoices_lead_id_idx on public.proforma_invoices (lead_id);
create index if not exists proforma_invoices_proposal_id_idx on public.proforma_invoices (proposal_id);
create index if not exists projects_business_unit_id_idx on public.projects (business_unit_id);
create index if not exists proposals_business_unit_id_idx on public.proposals (business_unit_id);
create index if not exists proposals_estimate_id_idx on public.proposals (estimate_id);
create index if not exists receipts_business_unit_id_idx on public.receipts (business_unit_id);
create index if not exists receipts_client_id_idx on public.receipts (client_id);
create index if not exists receipts_proforma_id_idx on public.receipts (proforma_id);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);

-- Supabase migration 20260920191039 · core_erp_schema
-- Mirrored from the applied migration history for reproducibility.

-- Bind Builds ERP core operational schema
-- Phase 2: sales -> commercial -> project -> delivery -> finance

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in (
    'founder','admin','sales','project_manager','designer',
    'site_engineer','finance','procurement','hr','viewer'
  ), false);
$$;

grant execute on function public.is_internal_user() to authenticated;

create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.business_units (id, code, name)
values
  ('9df8f882-bf7d-48e9-9afa-ded71465a2be','SBA','Studio Bind Architects'),
  ('6ca59d7f-4ac9-42da-9d73-25162c6bd0e0','BB','Bind Builds')
on conflict (id) do update
set code = excluded.code,
    name = excluded.name,
    active = true,
    updated_at = now();

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  lead_no text unique,
  name text not null,
  phone text,
  email text,
  area text,
  city text default 'Chennai',
  service text,
  source text,
  expected_value numeric(18,2) not null default 0,
  stage text not null default 'new',
  priority text not null default 'warm',
  notes text,
  owner_id uuid references auth.users(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  lead_id uuid references public.leads(id),
  name text not null,
  phone text,
  email text,
  city text,
  address text,
  gstin text,
  pan text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  estimate_no text unique,
  lead_id uuid references public.leads(id),
  project_id uuid,
  client_id uuid references public.clients(id),
  title text not null default 'Construction Estimate',
  status text not null default 'draft',
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  tax_rate numeric(8,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  issue_date date not null default current_date,
  valid_until date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  proposal_no text unique,
  lead_id uuid references public.leads(id),
  client_id uuid references public.clients(id),
  estimate_id uuid references public.estimates(id),
  title text not null default 'Project Proposal',
  service text,
  status text not null default 'draft',
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  tax_rate numeric(8,2) not null default 18,
  tax_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  valid_until date,
  notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  project_no text unique,
  code text unique,
  name text not null,
  client_id uuid references public.clients(id),
  lead_id uuid references public.leads(id),
  proposal_id uuid references public.proposals(id),
  service_type text,
  location text,
  contract_value numeric(18,2) not null default 0,
  status text not null default 'planning',
  health text not null default 'ontrack',
  progress_pct numeric(5,2) not null default 0,
  start_date date,
  target_end_date date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.estimates
  drop constraint if exists estimates_project_id_fkey;
alter table public.estimates
  add constraint estimates_project_id_fkey
  foreign key (project_id) references public.projects(id);

create table if not exists public.proforma_invoices (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  proforma_no text unique,
  lead_id uuid references public.leads(id),
  project_id uuid references public.projects(id),
  client_id uuid references public.clients(id),
  proposal_id uuid references public.proposals(id),
  title text not null default 'Proforma Invoice',
  status text not null default 'draft',
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  tax_rate numeric(8,2) not null default 18,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  invoice_no text unique,
  lead_id uuid references public.leads(id),
  project_id uuid references public.projects(id),
  client_id uuid references public.clients(id),
  proforma_id uuid references public.proforma_invoices(id),
  milestone_name text,
  milestone_pct numeric(8,2),
  status text not null default 'draft',
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  tax_rate numeric(8,2) not null default 18,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  receipt_no text not null unique,
  invoice_id uuid references public.invoices(id),
  proforma_id uuid references public.proforma_invoices(id),
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  receipt_date date not null default current_date,
  amount numeric(18,2) not null check (amount > 0),
  payment_mode text not null default 'bank_transfer',
  reference_no text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'todo',
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  title text not null,
  entity_type text not null default 'general',
  entity_id uuid,
  amount numeric(18,2) not null default 0,
  status text not null default 'pending',
  comment text,
  requested_by uuid default auth.uid(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  stage text,
  title text not null,
  due_date date,
  revision text not null default 'R0',
  status text not null default 'not_started',
  client_approval_required boolean not null default false,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  drawing_no text not null,
  title text not null,
  discipline text,
  revision text not null default 'R0',
  status text not null default 'draft',
  issue_date date,
  file_url text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, drawing_no, revision)
);

create table if not exists public.site_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  report_date date not null default current_date,
  labour_count integer not null default 0,
  work_completed text,
  issues text,
  weather text,
  status text not null default 'draft',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, report_date)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  code text unique,
  name text not null,
  category text,
  contact_person text,
  phone text,
  email text,
  gstin text,
  city text,
  payment_terms text,
  rating numeric(3,2) not null default 0,
  status text not null default 'active',
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  po_no text unique,
  project_id uuid references public.projects(id),
  vendor_id uuid references public.vendors(id),
  status text not null default 'draft',
  order_date date,
  expected_date date,
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id),
  project_id uuid references public.projects(id),
  vendor_id uuid references public.vendors(id),
  title text not null,
  category text,
  amount numeric(18,2) not null default 0,
  expense_date date not null default current_date,
  status text not null default 'draft',
  reference_no text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit/register relationships become enforceable after core tables exist.
alter table public.document_register
  drop constraint if exists document_register_lead_id_fkey,
  drop constraint if exists document_register_project_id_fkey,
  drop constraint if exists document_register_client_id_fkey;

alter table public.document_register
  add constraint document_register_lead_id_fkey foreign key (lead_id) references public.leads(id),
  add constraint document_register_project_id_fkey foreign key (project_id) references public.projects(id),
  add constraint document_register_client_id_fkey foreign key (client_id) references public.clients(id);

create index if not exists leads_stage_idx on public.leads(stage) where deleted_at is null;
create index if not exists leads_created_idx on public.leads(created_at desc) where deleted_at is null;
create index if not exists projects_status_idx on public.projects(status) where deleted_at is null;
create index if not exists proposals_status_idx on public.proposals(status) where deleted_at is null;
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists receipts_project_idx on public.receipts(project_id, receipt_date desc);
create index if not exists tasks_project_status_idx on public.tasks(project_id, status);
create index if not exists approvals_status_idx on public.approvals(status);
create index if not exists purchase_orders_project_idx on public.purchase_orders(project_id, status);
create index if not exists expenses_project_idx on public.expenses(project_id, expense_date desc);

-- Current app expects update timestamps.
do $body$
declare
  t text;
begin
  foreach t in array array[
    'business_units','leads','clients','estimates','proposals','projects',
    'proforma_invoices','invoices','tasks','approvals','design_deliverables',
    'drawings','site_reports','vendors','purchase_orders','expenses'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end
$body$;

-- Internal authenticated users only for phase 2.
do $body$
declare
  t text;
begin
  foreach t in array array[
    'business_units','leads','clients','estimates','proposals','projects',
    'proforma_invoices','invoices','receipts','tasks','approvals',
    'design_deliverables','drawings','site_reports','vendors',
    'purchase_orders','expenses'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists internal_access on public.%I', t);
    execute format(
      'create policy internal_access on public.%I for all to authenticated using (public.is_internal_user()) with check (public.is_internal_user())',
      t
    );
  end loop;
end
$body$;

-- Every new auth account gets a disabled-by-privilege viewer profile automatically.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)),
    'viewer',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_erp_profile on auth.users;
create trigger on_auth_user_created_erp_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

commit;;

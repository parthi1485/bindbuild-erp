-- Supabase migration 20260920190918 · erp_foundation_numbering
-- Mirrored from the applied migration history for reproducibility.

-- Bind Builds ERP foundation
-- Phase 1: roles, immutable numbering and central document register
-- Numbering locked:
-- BB-YY-#### / BB-P-YY-#### / EST-YY-#### / PRO-YY-####
-- PI-YY-YY-#### / REC-YY-YY-#### / INV-YY-YY-####

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'viewer'
    check (role in (
      'founder','admin','sales','project_manager','designer',
      'site_engineer','finance','procurement','hr','viewer','client','vendor'
    )),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true
  limit 1;
$$;

grant execute on function public.current_app_role() to authenticated;

create table if not exists public.document_sequences (
  doc_type text not null,
  period_key text not null,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (doc_type, period_key)
);

create table if not exists public.document_register (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null
    check (doc_type in ('estimate','proposal','proforma','receipt','invoice')),
  document_no text not null unique,
  lead_id uuid,
  project_id uuid,
  client_id uuid,
  amount numeric(18,2) not null default 0 check (amount >= 0),
  status text not null default 'issued',
  issue_date date not null default current_date,
  issued_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid default auth.uid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_register_type_date_idx
  on public.document_register (doc_type, issue_date desc);
create index if not exists document_register_lead_idx
  on public.document_register (lead_id);
create index if not exists document_register_project_idx
  on public.document_register (project_id);
create index if not exists document_register_client_idx
  on public.document_register (client_id);

create or replace function public.erp_period_key(
  p_doc_type text,
  p_date date default current_date
)
returns text
language plpgsql
immutable
as $$
declare
  y integer := extract(year from p_date)::integer;
  m integer := extract(month from p_date)::integer;
  fy_start integer;
begin
  if lower(p_doc_type) in ('proforma','receipt','invoice') then
    fy_start := case when m >= 4 then y else y - 1 end;
    return right(fy_start::text, 2) || '-' || right((fy_start + 1)::text, 2);
  end if;

  return to_char(p_date, 'YY');
end;
$$;

create or replace function public.erp_prefix(p_doc_type text)
returns text
language plpgsql
immutable
as $$
begin
  return case lower(p_doc_type)
    when 'lead' then 'BB'
    when 'project' then 'BB-P'
    when 'estimate' then 'EST'
    when 'proposal' then 'PRO'
    when 'proforma' then 'PI'
    when 'receipt' then 'REC'
    when 'invoice' then 'INV'
    else null
  end;
end;
$$;

create or replace function public.next_erp_number(
  p_doc_type text,
  p_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := lower(trim(p_doc_type));
  v_prefix text;
  v_period text;
  v_next bigint;
begin
  if public.current_app_role() not in (
    'founder','admin','sales','project_manager','designer',
    'site_engineer','finance','procurement','hr'
  ) then
    raise exception 'ERP numbering access denied';
  end if;

  v_prefix := public.erp_prefix(v_type);
  if v_prefix is null then
    raise exception 'Unsupported ERP number type: %', p_doc_type;
  end if;

  v_period := public.erp_period_key(v_type, p_date);

  insert into public.document_sequences (doc_type, period_key, last_number, updated_at)
  values (v_type, v_period, 1, now())
  on conflict (doc_type, period_key)
  do update
    set last_number = public.document_sequences.last_number + 1,
        updated_at = now()
  returning last_number into v_next;

  return v_prefix || '-' || v_period || '-' || lpad(v_next::text, 4, '0');
end;
$$;

grant execute on function public.next_erp_number(text, date) to authenticated;

create or replace function public.issue_document_number(
  p_doc_type text,
  p_issue_date date default current_date,
  p_lead_id uuid default null,
  p_project_id uuid default null,
  p_client_id uuid default null,
  p_amount numeric default 0,
  p_status text default 'issued',
  p_metadata jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := lower(trim(p_doc_type));
  v_no text;
begin
  if v_type not in ('estimate','proposal','proforma','receipt','invoice') then
    raise exception 'Unsupported document type: %', p_doc_type;
  end if;

  if public.current_app_role() is null then
    raise exception 'ERP access denied';
  end if;

  v_no := public.next_erp_number(v_type, p_issue_date);

  insert into public.document_register (
    doc_type, document_no, lead_id, project_id, client_id,
    amount, status, issue_date, metadata
  )
  values (
    v_type, v_no, p_lead_id, p_project_id, p_client_id,
    greatest(coalesce(p_amount, 0), 0), coalesce(nullif(p_status,''), 'issued'),
    p_issue_date, coalesce(p_metadata, '{}'::jsonb)
  );

  return v_no;
end;
$$;

grant execute on function public.issue_document_number(
  text, date, uuid, uuid, uuid, numeric, text, jsonb
) to authenticated;

create or replace function public.protect_document_register()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Document register rows cannot be deleted. Cancel the document instead.';
  end if;

  if old.document_no is distinct from new.document_no then
    raise exception 'Document numbers are immutable and can never be reused.';
  end if;

  if old.doc_type is distinct from new.doc_type then
    raise exception 'Document type cannot be changed after issuance.';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists document_register_protect on public.document_register;
create trigger document_register_protect
before update or delete on public.document_register
for each row execute function public.protect_document_register();

alter table public.profiles enable row level security;
alter table public.document_sequences enable row level security;
alter table public.document_register enable row level security;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.current_app_role() in ('founder','admin','hr')
);

drop policy if exists "document_register_read" on public.document_register;
create policy "document_register_read"
on public.document_register for select
to authenticated
using (public.current_app_role() is not null);

drop policy if exists "document_register_update" on public.document_register;
create policy "document_register_update"
on public.document_register for update
to authenticated
using (public.current_app_role() in ('founder','admin','finance','sales'))
with check (public.current_app_role() in ('founder','admin','finance','sales'));

revoke all on public.document_sequences from anon, authenticated;
grant select on public.document_register to authenticated;
grant select on public.profiles to authenticated;

-- Add numbering columns to existing module tables when they are already present.
alter table if exists public.leads add column if not exists lead_no text;
alter table if exists public.projects add column if not exists project_no text;
alter table if exists public.estimates add column if not exists estimate_no text;
alter table if exists public.proposals add column if not exists proposal_no text;
alter table if exists public.proforma_invoices add column if not exists proforma_no text;
alter table if exists public.invoices add column if not exists invoice_no text;
alter table if exists public.receipts add column if not exists receipt_no text;


-- Unique indexes for module tables are created by their module migrations
-- after the tables exist. This foundation migration is safe on a fresh project.

commit;;

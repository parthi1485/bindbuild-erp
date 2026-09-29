-- Supabase migration 20260920191131 · security_finance_integrity
-- Mirrored from the applied migration history for reproducibility.

-- Bind Builds ERP hardening
-- Phase 3: function permissions, policy tuning, finance integrity

begin;

alter function public.erp_period_key(text, date) set search_path = public;
alter function public.erp_prefix(text) set search_path = public;
alter function public.protect_document_register() set search_path = public;
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_internal_user() from public, anon;
revoke execute on function public.next_erp_number(text, date) from public, anon;
revoke execute on function public.issue_document_number(text, date, uuid, uuid, uuid, numeric, text, jsonb) from public, anon;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_internal_user() to authenticated;
grant execute on function public.next_erp_number(text, date) to authenticated;
grant execute on function public.issue_document_number(text, date, uuid, uuid, uuid, numeric, text, jsonb) to authenticated;

revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
revoke execute on function public.erp_period_key(text, date) from public, anon, authenticated;
revoke execute on function public.erp_prefix(text) from public, anon, authenticated;
revoke execute on function public.protect_document_register() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or public.current_app_role() in ('founder','admin','hr')
);

alter table public.receipts
  add column if not exists status text not null default 'issued',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

create or replace function public.sync_invoice_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_total numeric(18,2);
  v_paid numeric(18,2);
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  if v_invoice_id is null then
    return coalesce(new, old);
  end if;

  select i.total into v_total
  from public.invoices i
  where i.id = v_invoice_id;

  select coalesce(sum(r.amount), 0) into v_paid
  from public.receipts r
  where r.invoice_id = v_invoice_id
    and r.status <> 'cancelled';

  update public.invoices
  set amount_paid = least(v_paid, coalesce(v_total, 0)),
      status = case
        when coalesce(v_total,0) > 0 and v_paid >= v_total then 'paid'
        when v_paid > 0 then 'part_paid'
        when status in ('paid','part_paid') then 'issued'
        else status
      end,
      updated_at = now()
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.sync_invoice_collection() from public, anon, authenticated;

drop trigger if exists receipts_sync_invoice_collection on public.receipts;
create trigger receipts_sync_invoice_collection
after insert or update of amount, status, invoice_id on public.receipts
for each row execute function public.sync_invoice_collection();

create or replace function public.protect_receipt_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Receipts cannot be deleted. Cancel the receipt instead.';
  end if;

  if old.receipt_no is distinct from new.receipt_no then
    raise exception 'Receipt number is immutable.';
  end if;

  if old.amount is distinct from new.amount and old.status <> 'draft' then
    raise exception 'Issued receipt amount cannot be changed.';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    if coalesce(nullif(trim(new.cancellation_reason),''),'') = '' then
      raise exception 'Cancellation reason is required.';
    end if;
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_receipt_row() from public, anon, authenticated;

drop trigger if exists receipts_protect on public.receipts;
create trigger receipts_protect
before update or delete on public.receipts
for each row execute function public.protect_receipt_row();

create index if not exists clients_lead_id_idx on public.clients(lead_id);
create index if not exists proposals_lead_id_idx on public.proposals(lead_id);
create index if not exists proposals_client_id_idx on public.proposals(client_id);
create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists projects_lead_id_idx on public.projects(lead_id);
create index if not exists projects_proposal_id_idx on public.projects(proposal_id);
create index if not exists invoices_project_id_idx on public.invoices(project_id);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists proforma_project_id_idx on public.proforma_invoices(project_id);
create index if not exists receipts_invoice_id_idx on public.receipts(invoice_id);
create index if not exists design_project_id_idx on public.design_deliverables(project_id);
create index if not exists drawings_project_id_idx on public.drawings(project_id);
create index if not exists site_reports_project_id_idx on public.site_reports(project_id);
create index if not exists purchase_orders_vendor_id_idx on public.purchase_orders(vendor_id);

commit;;

-- Supabase migration 20260922233302 · analytics_backup_automation_controls
-- Mirrored from the applied migration history for reproducibility.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create extension if not exists pg_cron;

create table if not exists public.erp_notifications(
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid references public.business_units(id) on delete cascade,
  fingerprint text not null,
  kind text not null,
  severity text not null default 'info' check(severity in ('info','warning','critical')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  target_role text,
  target_user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'unread' check(status in ('unread','read','dismissed')),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists erp_notifications_dedupe_idx
  on public.erp_notifications(fingerprint,occurred_on,coalesce(target_user_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists erp_notifications_user_idx on public.erp_notifications(target_user_id,status,created_at desc);
create index if not exists erp_notifications_role_idx on public.erp_notifications(target_role,status,created_at desc);
create index if not exists erp_notifications_unit_idx on public.erp_notifications(business_unit_id,status,created_at desc);
alter table public.erp_notifications enable row level security;
grant select on public.erp_notifications to authenticated;
revoke update on public.erp_notifications from authenticated;

drop policy if exists erp_notifications_read on public.erp_notifications;
create policy erp_notifications_read on public.erp_notifications for select to authenticated
using (
  (select public.current_app_role()) in ('founder','admin')
  or target_user_id=(select auth.uid())
  or (target_user_id is null and (target_role is null or target_role=(select public.current_app_role())))
);

create table if not exists public.erp_notification_reads(
  notification_id uuid not null references public.erp_notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'read' check(status in ('read','dismissed')),
  read_at timestamptz not null default now(),
  primary key(notification_id,user_id)
);
create index if not exists erp_notification_reads_user_idx
  on public.erp_notification_reads(user_id,status,read_at desc);
alter table public.erp_notification_reads enable row level security;
grant select,insert,update,delete on public.erp_notification_reads to authenticated;

drop policy if exists erp_notification_reads_select on public.erp_notification_reads;
drop policy if exists erp_notification_reads_insert on public.erp_notification_reads;
drop policy if exists erp_notification_reads_update on public.erp_notification_reads;
drop policy if exists erp_notification_reads_delete on public.erp_notification_reads;
create policy erp_notification_reads_select on public.erp_notification_reads for select to authenticated
using(user_id=(select auth.uid()));
create policy erp_notification_reads_insert on public.erp_notification_reads for insert to authenticated
with check(user_id=(select auth.uid()));
create policy erp_notification_reads_update on public.erp_notification_reads for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()));
create policy erp_notification_reads_delete on public.erp_notification_reads for delete to authenticated
using(user_id=(select auth.uid()));

create table if not exists public.automation_runs(
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check(status in ('running','success','failed')),
  result jsonb,
  error text
);
alter table public.automation_runs enable row level security;
grant select on public.automation_runs to authenticated;
drop policy if exists automation_runs_read on public.automation_runs;
create policy automation_runs_read on public.automation_runs for select to authenticated
using ((select public.current_app_role()) in ('founder','admin'));

create table if not exists public.application_backup_log(
  id uuid primary key default gen_random_uuid(),
  operation text not null check(operation in ('export','validate','restore')),
  format_version integer not null default 1,
  table_count integer not null default 0,
  row_count bigint not null default 0,
  byte_estimate bigint,
  status text not null check(status in ('success','failed')),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists application_backup_log_created_idx on public.application_backup_log(created_at desc);
create index if not exists application_backup_log_created_by_idx
  on public.application_backup_log(created_by) where created_by is not null;
alter table public.application_backup_log enable row level security;
grant select,insert on public.application_backup_log to authenticated;
drop policy if exists application_backup_log_read on public.application_backup_log;
drop policy if exists application_backup_log_insert on public.application_backup_log;
create policy application_backup_log_read on public.application_backup_log for select to authenticated
using ((select public.current_app_role()) in ('founder','admin'));
create policy application_backup_log_insert on public.application_backup_log for insert to authenticated
with check (
  (select public.current_app_role()) in ('founder','admin')
  and created_by=(select auth.uid())
);

create or replace function public.management_dashboard(
  p_business_unit_id uuid,
  p_from date,
  p_to date
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare out jsonb;
begin
  if public.current_app_role() is null then raise exception 'Internal ERP access required'; end if;
  if p_from is null or p_to is null or p_to<p_from then raise exception 'Invalid analytics range'; end if;

  with
  scoped_leads as (
    select * from public.leads l
    where l.deleted_at is null
      and (p_business_unit_id is null or l.business_unit_id is null or l.business_unit_id=p_business_unit_id)
  ),
  scoped_projects as (
    select * from public.projects p
    where p.deleted_at is null
      and (p_business_unit_id is null or p.business_unit_id is null or p.business_unit_id=p_business_unit_id)
  ),
  scoped_receipts as (
    select * from public.receipts r
    where r.status='issued'
      and r.receipt_date between p_from and p_to
      and (p_business_unit_id is null or r.business_unit_id is null or r.business_unit_id=p_business_unit_id)
  ),
  scoped_invoices as (
    select * from public.invoices i
    where i.deleted_at is null and i.status<>'cancelled'
      and (p_business_unit_id is null or i.business_unit_id is null or i.business_unit_id=p_business_unit_id)
  ),
  scoped_expenses as (
    select * from public.expenses e
    where e.status in ('approved','paid')
      and e.expense_date between p_from and p_to
      and (p_business_unit_id is null or e.business_unit_id is null or e.business_unit_id=p_business_unit_id)
  ),
  scoped_vendor_bills as (
    select * from public.vendor_bills v
    where v.status in ('approved','part_paid')
      and (p_business_unit_id is null or v.business_unit_id is null or v.business_unit_id=p_business_unit_id)
  ),
  scoped_pos as (
    select * from public.purchase_orders po
    where po.status in ('approval','approved','ordered','partly_delivered')
      and (p_business_unit_id is null or po.business_unit_id is null or po.business_unit_id=p_business_unit_id)
  ),
  scoped_employees as (
    select * from public.employees e
    where e.status in ('active','on_leave')
      and (p_business_unit_id is null or e.business_unit_id is null or e.business_unit_id=p_business_unit_id)
  ),
  month_series as (
    select gs::date month_start
    from generate_series(date_trunc('month',p_from)::date,date_trunc('month',p_to)::date,interval '1 month') gs
  ),
  monthly as (
    select m.month_start,
      coalesce((select sum(r.amount) from scoped_receipts r where date_trunc('month',r.receipt_date)::date=m.month_start),0) collections,
      coalesce((select sum(e.amount) from scoped_expenses e where date_trunc('month',e.expense_date)::date=m.month_start),0) booked_cost
    from month_series m
  ),
  project_cost as (
    select project_id,sum(amount) booked_cost
    from scoped_expenses where project_id is not null group by project_id
  ),
  project_receipts as (
    select project_id,sum(amount) collected
    from public.receipts r
    where r.status='issued' and project_id is not null
      and (p_business_unit_id is null or r.business_unit_id is null or r.business_unit_id=p_business_unit_id)
    group by project_id
  ),
  project_invoices as (
    select project_id,
      sum(greatest(total-coalesce(credited_amount,0),0)) billed,
      sum(greatest(total-coalesce(credited_amount,0)-amount_paid,0)) receivable
    from scoped_invoices where project_id is not null group by project_id
  )
  select jsonb_build_object(
    'range',jsonb_build_object('from',p_from,'to',p_to),
    'kpis',jsonb_build_object(
      'collections',coalesce((select sum(amount) from scoped_receipts),0),
      'booked_cost',coalesce((select sum(amount) from scoped_expenses),0),
      'invoiced',coalesce((select sum(greatest(total-coalesce(credited_amount,0),0)) from scoped_invoices where issue_date between p_from and p_to),0),
      'receivables',coalesce((select sum(greatest(total-coalesce(credited_amount,0)-amount_paid,0)) from scoped_invoices),0),
      'vendor_payables',coalesce((select sum(greatest(total-amount_paid,0)) from scoped_vendor_bills),0),
      'open_po_commitment',coalesce((select sum(total) from scoped_pos),0),
      'active_projects',(select count(*) from scoped_projects where status not in ('completed','cancelled')),
      'at_risk_projects',(select count(*) from scoped_projects where status not in ('completed','cancelled') and health in ('atrisk','at_risk','critical')),
      'overdue_projects',(select count(*) from scoped_projects where status not in ('completed','cancelled') and target_end_date is not null and target_end_date<current_date),
      'new_leads',(select count(*) from scoped_leads where created_at::date between p_from and p_to),
      'won_leads',(select count(*) from scoped_leads where stage='won' and updated_at::date between p_from and p_to),
      'lost_leads',(select count(*) from scoped_leads where stage='lost' and updated_at::date between p_from and p_to),
      'win_rate',coalesce(round(100.0*(select count(*) from scoped_leads where stage='won' and updated_at::date between p_from and p_to)
        / nullif((select count(*) from scoped_leads where stage in ('won','lost') and updated_at::date between p_from and p_to),0),1),0),
      'open_pipeline',coalesce((select sum(expected_value) from scoped_leads where stage not in ('won','lost')),0),
      'open_tasks',(select count(*) from public.tasks t where t.status not in ('done','cancelled')
        and (t.project_id is null or exists(select 1 from scoped_projects p where p.id=t.project_id))),
      'overdue_tasks',(select count(*) from public.tasks t where t.status not in ('done','cancelled') and t.due_at<now()
        and (t.project_id is null or exists(select 1 from scoped_projects p where p.id=t.project_id))),
      'pending_approvals',(select count(*) from public.approvals a where a.status='pending'
        and exists(select 1 from scoped_projects p where p.id=a.project_id)),
      'headcount',(select count(*) from scoped_employees),
      'avg_capacity',coalesce((select round(avg(x.pct),1) from (
        select e.id,coalesce(sum(a.allocation_pct),0) pct
        from scoped_employees e
        left join public.project_allocations a on a.employee_id=e.id and a.status='active'
          and a.start_date<=current_date and coalesce(a.end_date,'9999-12-31'::date)>=current_date
        group by e.id
      ) x),0)
    ),
    'monthly',coalesce((select jsonb_agg(jsonb_build_object(
      'month',to_char(month_start,'YYYY-MM'),'label',to_char(month_start,'Mon'),
      'collections',collections,'booked_cost',booked_cost
    ) order by month_start) from monthly),'[]'::jsonb),
    'pipeline',coalesce((select jsonb_agg(jsonb_build_object('stage',stage,'count',n,'value',value) order by n desc)
      from (select stage,count(*) n,coalesce(sum(expected_value),0) value from scoped_leads where stage not in ('won','lost') group by stage) s),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(jsonb_build_object('source',source,'count',n,'value',value) order by n desc)
      from (select coalesce(nullif(trim(source),''),'Unknown') source,count(*) n,coalesce(sum(expected_value),0) value
            from scoped_leads where created_at::date between p_from and p_to group by 1) s),'[]'::jsonb),
    'expense_categories',coalesce((select jsonb_agg(jsonb_build_object('category',category,'amount',amount) order by amount desc)
      from (select coalesce(nullif(trim(category),''),'Other') category,sum(amount) amount from scoped_expenses group by 1) e),'[]'::jsonb),
    'project_health',coalesce((select jsonb_agg(jsonb_build_object('health',health,'count',n) order by n desc)
      from (select coalesce(nullif(trim(health),''),'unknown') health,count(*) n from scoped_projects
            where status not in ('completed','cancelled') group by 1) h),'[]'::jsonb),
    'top_projects',coalesce((select jsonb_agg(to_jsonb(x) order by x.contract_value desc)
      from (
        select p.id,p.project_no,p.code,p.name,p.status,p.health,p.progress_pct,p.contract_value,
          coalesce(pi.billed,0) billed,coalesce(pr.collected,0) collected,coalesce(pi.receivable,0) receivable,
          coalesce(pc.booked_cost,0) booked_cost
        from scoped_projects p
        left join project_invoices pi on pi.project_id=p.id
        left join project_receipts pr on pr.project_id=p.id
        left join project_cost pc on pc.project_id=p.id
        order by p.contract_value desc nulls last limit 10
      ) x),'[]'::jsonb),
    'risks',jsonb_build_object(
      'overdue_invoices',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'invoice_no',i.invoice_no,'project_id',i.project_id,'due_date',i.due_date,
        'balance',greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0)
      ) order by i.due_date) from scoped_invoices i
      where i.due_date<current_date and greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0)>0),'[]'::jsonb),
      'overdue_vendor_bills',coalesce((select jsonb_agg(jsonb_build_object(
        'id',v.id,'bill_no',coalesce(v.internal_no,v.bill_no),'project_id',v.project_id,'due_date',v.due_date,
        'balance',greatest(v.total-v.amount_paid,0)
      ) order by v.due_date) from scoped_vendor_bills v
      where v.due_date<current_date and greatest(v.total-v.amount_paid,0)>0),'[]'::jsonb)
    )
  ) into out;
  return out;
end $$;
revoke all on function public.management_dashboard(uuid,date,date) from public;
grant execute on function public.management_dashboard(uuid,date,date) to authenticated;

create or replace function public.export_application_backup()
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare
  tables text[]:=array[
    'business_units','profiles','organisation_profiles','accounting_period_locks',
    'leads','clients','estimates','estimate_items','proposals','proposal_items',
    'projects','preconstruction_steps','construction_stages','project_progress_snapshots',
    'design_deliverables','drawings','approvals','tasks',
    'project_documents','document_revisions','document_approvals','document_register',
    'meetings','meeting_attendees','meeting_notes','meeting_action_items',
    'site_reports','site_report_activities','site_report_labour','site_report_materials','site_report_equipment',
    'site_inspections','site_issues','quality_checks',
    'proforma_invoices','proforma_items','invoices','invoice_items','credit_notes','receipts','expenses',
    'materials','stores','material_requisitions','material_requisition_items',
    'vendor_quotes','vendor_quote_items','purchase_orders','po_items','goods_receipts','goods_receipt_items',
    'stock_ledger','vendors','vendor_bills','vendor_payments','vendor_rfq_invites','vendor_rfq_items',
    'employees','employee_compensation','attendance','leave_types','leave_requests','project_allocations',
    'payroll_inputs','payroll_runs','payroll_entries','reimbursements',
    'performance_cycles','performance_goals','performance_reviews','kudos',
    'portal_memberships','portal_messages','document_sequences'
  ];
  t text; rows jsonb; data jsonb:='{}'::jsonb; total_rows bigint:=0; result jsonb;
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Backup export denied'; end if;
  foreach t in array tables loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x',t) into rows;
    data:=data||jsonb_build_object(t,rows);
    total_rows:=total_rows+jsonb_array_length(rows);
  end loop;
  result:=jsonb_build_object(
    'format','bindbuild-erp-application-backup',
    'format_version',1,
    'created_at',now(),
    'created_by',(select auth.uid()),
    'table_count',array_length(tables,1),
    'row_count',total_rows,
    'exclusions',jsonb_build_array(
      'Supabase Auth user credentials/sessions',
      'Storage file bytes (document metadata and storage paths are included)',
      'Platform configuration, secrets, Vercel configuration, cron execution history'
    ),
    'data',data
  );
  insert into public.application_backup_log(operation,format_version,table_count,row_count,byte_estimate,status,created_by,note)
  values('export',1,array_length(tables,1),total_rows,octet_length(result::text),'success',(select auth.uid()),'Application JSON backup generated');
  return result;
end $$;
revoke all on function public.export_application_backup() from public;
grant execute on function public.export_application_backup() to authenticated;

create or replace function private.backup_auth_mismatches(p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path=public,private,pg_catalog,auth
as $$
declare caller uuid:=(select auth.uid()); caller_role text; missing_count integer;
begin
  select role into caller_role from public.profiles where id=caller and is_active=true;
  if caller is null or caller_role not in ('founder','admin') then raise exception 'Backup validation denied'; end if;
  with ids as (
    select nullif(x->>'id','')::uuid id
    from jsonb_array_elements(coalesce(p_payload->'data'->'profiles','[]'::jsonb)) x
    union
    select nullif(x->>'user_id','')::uuid
    from jsonb_array_elements(coalesce(p_payload->'data'->'portal_memberships','[]'::jsonb)) x
    where nullif(x->>'user_id','') is not null and coalesce(x->>'status','')='active'
  )
  select count(*) into missing_count
  from ids i
  where i.id is not null and not exists(select 1 from auth.users u where u.id=i.id);
  return missing_count;
end $$;
revoke all on function private.backup_auth_mismatches(jsonb) from public;
grant execute on function private.backup_auth_mismatches(jsonb) to authenticated;

create or replace function public.validate_application_backup(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,private,pg_catalog
as $$
declare
  data jsonb; k text; table_count int:=0; row_count bigint:=0; live_rows bigint:=0;
  auth_mismatches integer:=0; result jsonb;
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Backup validation denied'; end if;
  if coalesce(p_payload->>'format','')<>'bindbuild-erp-application-backup' then raise exception 'Not a Bind Build ERP application backup'; end if;
  if coalesce((p_payload->>'format_version')::int,0)<>1 then raise exception 'Unsupported backup format version'; end if;
  data:=p_payload->'data';
  if data is null or jsonb_typeof(data)<>'object' then raise exception 'Backup data object is missing'; end if;
  if not (data ? 'business_units') or not (data ? 'profiles') then raise exception 'Backup is missing required system tables'; end if;

  for k in select jsonb_object_keys(data) loop
    if jsonb_typeof(data->k)<>'array' then raise exception 'Backup table % is not an array',k; end if;
    table_count:=table_count+1;
    row_count:=row_count+jsonb_array_length(data->k);
  end loop;

  select
    (select count(*) from public.leads where deleted_at is null)+
    (select count(*) from public.projects where deleted_at is null)+
    (select count(*) from public.invoices where deleted_at is null)+
    (select count(*) from public.receipts)+
    (select count(*) from public.expenses)+
    (select count(*) from public.purchase_orders)+
    (select count(*) from public.employees)+
    (select count(*) from public.project_documents)
  into live_rows;

  auth_mismatches:=private.backup_auth_mismatches(p_payload);

  result:=jsonb_build_object(
    'valid',true,
    'format_version',1,
    'table_count',table_count,
    'row_count',row_count,
    'created_at',p_payload->>'created_at',
    'restore_allowed',live_rows=0 and auth_mismatches=0,
    'live_operational_rows',live_rows,
    'auth_id_mismatches',auth_mismatches,
    'note',case
      when live_rows>0 then 'Restore is blocked because live operational records exist'
      when auth_mismatches>0 then 'Restore is blocked because matching Supabase Auth user IDs are missing'
      else 'Restore target is operationally empty and Auth IDs are compatible'
    end
  );

  insert into public.application_backup_log(operation,format_version,table_count,row_count,byte_estimate,status,created_by,note)
  values('validate',1,table_count,row_count,octet_length(p_payload::text),'success',(select auth.uid()),result->>'note');

  return result;
end $$;
revoke all on function public.validate_application_backup(jsonb) from public;
grant execute on function public.validate_application_backup(jsonb) to authenticated;

create or replace function private.restore_application_backup(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog,auth
as $$
declare
  caller uuid:=(select auth.uid()); caller_role text; live_rows bigint;
  tables text[]:=array[
    'business_units','profiles','organisation_profiles','accounting_period_locks',
    'leads','clients','estimates','estimate_items','proposals','proposal_items',
    'projects','preconstruction_steps','construction_stages','project_progress_snapshots',
    'design_deliverables','drawings','approvals','tasks',
    'project_documents','document_revisions','document_approvals','document_register',
    'meetings','meeting_attendees','meeting_notes','meeting_action_items',
    'site_reports','site_report_activities','site_report_labour','site_report_materials','site_report_equipment',
    'site_inspections','site_issues','quality_checks',
    'proforma_invoices','proforma_items','invoices','invoice_items','credit_notes','receipts','expenses',
    'materials','stores','material_requisitions','material_requisition_items',
    'vendor_quotes','vendor_quote_items','purchase_orders','po_items','goods_receipts','goods_receipt_items',
    'stock_ledger','vendors','vendor_bills','vendor_payments','vendor_rfq_invites','vendor_rfq_items',
    'employees','employee_compensation','attendance','leave_types','leave_requests','project_allocations',
    'payroll_inputs','payroll_runs','payroll_entries','reimbursements',
    'performance_cycles','performance_goals','performance_reviews','kudos',
    'portal_memberships','portal_messages','document_sequences'
  ];
  t text; cols text; stmt text; inserted bigint:=0; n bigint; payload_rows jsonb; fk record;
begin
  select role into caller_role from public.profiles where id=caller and is_active=true;
  if caller is null or caller_role not in ('founder','admin') then raise exception 'Backup restore denied'; end if;
  if coalesce(p_payload->>'format','')<>'bindbuild-erp-application-backup'
     or coalesce((p_payload->>'format_version')::int,0)<>1 then raise exception 'Invalid or unsupported backup'; end if;

  select
    (select count(*) from public.leads where deleted_at is null)+
    (select count(*) from public.projects where deleted_at is null)+
    (select count(*) from public.invoices where deleted_at is null)+
    (select count(*) from public.receipts)+
    (select count(*) from public.expenses)+
    (select count(*) from public.purchase_orders)+
    (select count(*) from public.employees)+
    (select count(*) from public.project_documents)
  into live_rows;
  if live_rows>0 then raise exception 'Restore requires an empty operational system; % live rows found',live_rows; end if;

  create temp table if not exists tmp_bindbuild_restore_fks(
    table_name text, constraint_name text, definition text
  ) on commit drop;
  truncate tmp_bindbuild_restore_fks;

  foreach t in array tables loop
    execute format('alter table public.%I disable trigger user',t);
  end loop;

  for fk in
    select c.relname table_name,con.conname constraint_name,pg_get_constraintdef(con.oid) definition
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace ns on ns.oid=c.relnamespace
    join pg_class rc on rc.oid=con.confrelid
    join pg_namespace rns on rns.oid=rc.relnamespace
    where con.contype='f' and ns.nspname='public' and rns.nspname='public'
      and c.relname=any(tables) and rc.relname=any(tables)
  loop
    insert into tmp_bindbuild_restore_fks values(fk.table_name,fk.constraint_name,fk.definition);
    execute format('alter table public.%I drop constraint %I',fk.table_name,fk.constraint_name);
  end loop;

  foreach t in array tables loop
    payload_rows:=p_payload->'data'->t;
    if payload_rows is null or jsonb_typeof(payload_rows)<>'array' or jsonb_array_length(payload_rows)=0 then continue; end if;

    select string_agg(quote_ident(a.attname),',' order by a.attnum)
    into cols
    from pg_attribute a
    where a.attrelid=format('public.%I',t)::regclass
      and a.attnum>0 and not a.attisdropped and a.attgenerated='' and a.attidentity='';

    if cols is null then continue; end if;
    stmt:=format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I,$1) on conflict do nothing',
      t,cols
    );
    execute stmt using payload_rows;
    get diagnostics n=row_count; inserted:=inserted+n;
  end loop;

  for fk in select * from tmp_bindbuild_restore_fks loop
    execute format('alter table public.%I add constraint %I %s',fk.table_name,fk.constraint_name,fk.definition);
  end loop;

  foreach t in array tables loop
    execute format('alter table public.%I enable trigger user',t);
  end loop;

  insert into public.application_backup_log(operation,format_version,table_count,row_count,byte_estimate,status,created_by,note)
  values('restore',1,array_length(tables,1),inserted,octet_length(p_payload::text),'success',caller,'Application JSON backup restored and constraints revalidated');

  return jsonb_build_object('restored',true,'rows_inserted',inserted,'tables_considered',array_length(tables,1),'constraints_revalidated',true);
end $$;
revoke all on function private.restore_application_backup(jsonb) from public;
grant execute on function private.restore_application_backup(jsonb) to authenticated;

create or replace function public.restore_application_backup(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,private
as $$
declare check_result jsonb;
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Backup restore denied'; end if;
  check_result:=public.validate_application_backup(p_payload);
  if coalesce((check_result->>'restore_allowed')::boolean,false)=false then
    raise exception 'Restore blocked: %',check_result->>'note';
  end if;
  return private.restore_application_backup(p_payload);
end $$;
revoke all on function public.restore_application_backup(jsonb) from public;
grant execute on function public.restore_application_backup(jsonb) to authenticated;

create or replace function private.run_daily_erp_automations()
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare v_uid uuid:=(select auth.uid()); v_role text; v_run uuid; inserted_count int:=0; n int;
begin
  if v_uid is not null then
    select role into v_role from public.profiles where id=v_uid and is_active=true;
    if v_role not in ('founder','admin') then raise exception 'Automation run denied'; end if;
  end if;

  insert into public.automation_runs(job_name) values('daily-ops-scan') returning id into v_run;
  delete from public.erp_notifications where created_at<now()-interval '180 days';

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select p.business_unit_id,'task-overdue:'||t.id,'task_overdue',
    case when t.due_at<now()-interval '3 days' then 'critical' else 'warning' end,
    'Overdue task',t.title||' · due '||to_char(t.due_at at time zone 'Asia/Kolkata','DD Mon'),
    'task',t.id,case when t.assigned_to is null then 'project_manager' else null end,current_date
  from public.tasks t
  left join public.projects p on p.id=t.project_id
  where t.status not in ('done','cancelled') and t.due_at<now()
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_user_id,occurred_on)
  select p.business_unit_id,'task-owner-overdue:'||t.id,'task_overdue','warning',
    'Task needs attention',t.title||' · overdue since '||to_char(t.due_at at time zone 'Asia/Kolkata','DD Mon'),
    'task',t.id,t.assigned_to,current_date
  from public.tasks t left join public.projects p on p.id=t.project_id
  where t.status not in ('done','cancelled') and t.due_at<now() and t.assigned_to is not null
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select i.business_unit_id,'invoice-overdue:'||i.id,'invoice_overdue',
    case when current_date-i.due_date>=7 then 'critical' else 'warning' end,
    'Client payment overdue',coalesce(i.invoice_no,'Invoice')||' · balance ₹'||to_char(greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0),'FM999G999G999G990'),
    'invoice',i.id,'finance',current_date
  from public.invoices i
  where i.deleted_at is null and i.status<>'cancelled' and i.due_date<current_date
    and greatest(i.total-coalesce(i.credited_amount,0)-i.amount_paid,0)>0
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select v.business_unit_id,'vendor-bill-due:'||v.id,'vendor_bill_due',
    case when current_date-v.due_date>=7 then 'critical' else 'warning' end,
    'Vendor bill overdue',coalesce(v.internal_no,v.bill_no)||' · balance ₹'||to_char(greatest(v.total-v.amount_paid,0),'FM999G999G999G990'),
    'vendor_bill',v.id,'finance',current_date
  from public.vendor_bills v
  where v.status in ('approved','part_paid') and v.due_date<current_date and greatest(v.total-v.amount_paid,0)>0
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select p.business_unit_id,'approval-waiting:'||a.id,'approval_pending','warning',
    'Approval waiting over 48h',a.title||' · requested '||to_char(a.created_at at time zone 'Asia/Kolkata','DD Mon'),
    'approval',a.id,'project_manager',current_date
  from public.approvals a join public.projects p on p.id=a.project_id
  where a.status='pending' and a.created_at<now()-interval '48 hours'
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  insert into public.erp_notifications(business_unit_id,fingerprint,kind,severity,title,body,entity_type,entity_id,target_role,occurred_on)
  select s.business_unit_id,'low-stock:'||s.store_id||':'||s.material_id,'low_stock',
    case when s.qty<=0 then 'critical' else 'warning' end,
    'Site stock '||case when s.qty<=0 then 'out' else 'low' end,
    coalesce(s.name,s.code,'Material')||' · '||coalesce(s.qty,0)||' '||coalesce(s.unit,''),
    'material',s.material_id,'procurement',current_date
  from public.stock_balances s
  where s.reorder_level is not null and s.qty<=s.reorder_level
  on conflict do nothing;
  get diagnostics n=row_count; inserted_count:=inserted_count+n;

  update public.automation_runs
  set status='success',finished_at=now(),result=jsonb_build_object('notifications_created',inserted_count)
  where id=v_run;
  return jsonb_build_object('run_id',v_run,'notifications_created',inserted_count);
exception when others then
  if v_run is not null then
    update public.automation_runs set status='failed',finished_at=now(),error=sqlerrm where id=v_run;
  end if;
  raise;
end $$;
revoke all on function private.run_daily_erp_automations() from public;
grant execute on function private.run_daily_erp_automations() to authenticated;

create or replace function public.run_erp_automations_now()
returns jsonb
language plpgsql
security invoker
set search_path=public,private
as $$
begin
  if public.current_app_role() not in ('founder','admin') then raise exception 'Automation run denied'; end if;
  return private.run_daily_erp_automations();
end $$;
revoke all on function public.run_erp_automations_now() from public;
grant execute on function public.run_erp_automations_now() to authenticated;

select cron.schedule(
  'bindbuild-daily-ops-scan',
  '30 2 * * *',
  $$select private.run_daily_erp_automations();$$
);;

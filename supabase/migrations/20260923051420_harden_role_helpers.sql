create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path=public,auth,pg_catalog
as $$
  select p.role
  from public.profiles p
  where p.id=(select auth.uid()) and p.is_active=true
  limit 1;
$$;

revoke all on function private.current_app_role() from public;
grant execute on function private.current_app_role() to authenticated;

create or replace function public.current_app_role()
returns text
language sql
stable
security invoker
set search_path=public,private,pg_catalog
as $$
  select private.current_app_role();
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security invoker
set search_path=public,private,pg_catalog
as $$
  select coalesce(private.current_app_role() in (
    'founder','admin','sales','project_manager','designer',
    'site_engineer','finance','procurement','hr','viewer'
  ),false);
$$;

revoke all on function public.is_internal_user() from public;
grant execute on function public.is_internal_user() to authenticated;

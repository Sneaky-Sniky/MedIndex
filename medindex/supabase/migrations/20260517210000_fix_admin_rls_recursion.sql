-- Admin policies that subquery public.profiles cause infinite RLS recursion (42P17).
-- Use a security definer helper so role checks bypass profiles RLS.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists error_reports_admin on public.error_reports;
create policy error_reports_admin on public.error_reports
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists medicines_admin_update on public.medicines;
create policy medicines_admin_update on public.medicines
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

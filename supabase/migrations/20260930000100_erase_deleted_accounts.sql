-- Permanently erases accounts 7 days after the user asked to delete them.
-- Deleting the auth user cascades to profiles, user_data and consent_requests.
-- Runs every day at 03:17 UTC. Needs the pg_cron extension (Database → Extensions in the dashboard).

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.erase_deleted_accounts()
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from auth.users u
   using public.profiles p
   where p.id = u.id and p.deletion_at is not null and p.deletion_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.erase_deleted_accounts() from public, anon, authenticated;

select cron.schedule('erase-deleted-accounts', '17 3 * * *', 'select public.erase_deleted_accounts()');

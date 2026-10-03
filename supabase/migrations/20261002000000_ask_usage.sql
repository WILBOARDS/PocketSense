-- Daily question count for "Ask", so one account can't run up the AI bill.
-- Only the count is kept: never the questions or the answers.

create table public.ask_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ask_usage enable row level security;
-- No policies: only the ask Edge Function (service role) reads or writes it.
revoke all on public.ask_usage from anon, authenticated;

-- Adds one question for today and returns true, or returns false when the limit is already reached.
create or replace function public.ask_take(p_user uuid, p_limit int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  insert into public.ask_usage as u (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into n;
  return n is not null;
end;
$$;

revoke execute on function public.ask_take(uuid, int) from public, anon, authenticated;
grant execute on function public.ask_take(uuid, int) to service_role;
grant all on public.ask_usage to service_role;

-- Old counts are no use after a day; clear them weekly.
select cron.schedule('clear-ask-usage', '41 3 * * 1', $$delete from public.ask_usage where day < current_date - 7$$);

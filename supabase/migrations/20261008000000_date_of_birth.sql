-- Age is decided from the full date of birth and today's date in Indonesia (Jakarta), not from the birth year.
-- Someone born in January 2008 is an adult from their 18th birthday; someone born in December 2008 is not until December.
--
-- Rules this file sets:
--   * Accounts are for 13 and over. Under 13 can still use the app on the phone with no account.
--   * can_sync() needs a date of birth, age 13+, no pending deletion, and either 18+ or a parent's approval.
--   * Ask is 18+ only and is checked in the `ask` function, not here.
--   * An adult can correct their date of birth, but only to another adult date, and not more than once in 30 days.
--   * Accounts that never finish sign-up (no date of birth, or under 13) are erased after a day, and accounts
--     whose email was never confirmed and that never signed in are erased after a week.
--   * Parent-approval emails are rate limited in the database, atomically (consent_take).
--
-- Parent approval itself stays as the first migration built it (profiles.parent_email,
-- profiles.consent_approved_at, consent_requests).
--
-- The project had no accounts when this was written, so birth_year is replaced instead of converted.
-- On a project that already has accounts, convert first: nothing here can guess a day and month.
--
-- The date of birth is never returned by account_status(), never sent to Ask, and is removed from the login
-- token's metadata as soon as the profile is created. (A signed-in user can still read their own row in
-- public.profiles, which is theirs; the app does not.)

-- ─── columns ──────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists date_of_birth date
  check (date_of_birth >= date '1900-01-01');
alter table public.profiles add column if not exists dob_changed_at timestamptz;

-- A normalised form of the parent's address (no +tags, no dots at Gmail), so one inbox is counted once.
alter table public.consent_requests add column if not exists parent_key text;
update public.consent_requests set parent_key = lower(parent_email) where parent_key is null;
alter table public.consent_requests alter column parent_key set not null;
-- Set when the email could not be sent, so an outage or a wrong Brevo setting doesn't use up anyone's daily limit.
alter table public.consent_requests add column if not exists failed_at timestamptz;
create index if not exists consent_requests_key_idx on public.consent_requests (parent_key, created_at desc);

-- ─── rules ────────────────────────────────────────────────────────────────────

create or replace function public.today_jakarta()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- Same rule as app/src/lib/age.ts and supabase/functions/_shared/age.ts. No date counts as under 18.
create or replace function public.is_minor(p_dob date)
returns boolean language sql stable set search_path = '' as $$
  select p_dob is null or extract(year from age(public.today_jakarta(), p_dob)) < 18;
$$;

-- Under the minimum age for an account (13). No date is not "too young": it is "not finished".
create or replace function public.is_too_young(p_dob date)
returns boolean language sql stable set search_path = '' as $$
  select p_dob is not null and extract(year from age(public.today_jakarta(), p_dob)) < 13;
$$;

create or replace function public.can_sync(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.date_of_birth is not null
      and not public.is_too_young(p.date_of_birth)
      and p.deletion_at is null
      and (not public.is_minor(p.date_of_birth) or p.consent_approved_at is not null)
  );
$$;

-- ─── new users ────────────────────────────────────────────────────────────────

-- Email sign-up passes date_of_birth (YYYY-MM-DD) and privacy_agreed in the user metadata. Google sign-up can't,
-- so its profile starts without a date and the app calls set_date_of_birth() afterwards.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  d date;
begin
  begin
    d := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  exception when others then
    d := null;
  end;
  if d is not null and (d < date '1900-01-01' or d > public.today_jakarta()) then
    d := null;
  end if;
  insert into public.profiles (id, date_of_birth, privacy_agreed_at)
  values (
    new.id, d,
    case when d is not null and coalesce((new.raw_user_meta_data ->> 'privacy_agreed')::boolean, false) then now() end
  );
  -- Keep the date in the profile only, not in the metadata that travels with the login token.
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'date_of_birth' where id = new.id;
  return new;
end;
$$;

-- ─── functions the app calls ──────────────────────────────────────────────────

-- Everything the app needs to decide which screen to show after sign-in. The date itself is not returned.
-- consent_declined: the parent of the address now on the profile said "don't approve" (on any of the links sent).
create or replace function public.account_status()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'has_birth_date', p.date_of_birth is not null,
    'minor', public.is_minor(p.date_of_birth),
    'too_young', public.is_too_young(p.date_of_birth),
    'parent_email', p.parent_email,
    'consent_approved', p.consent_approved_at is not null,
    'consent_declined', exists (
      select 1 from public.consent_requests c
       where c.user_id = p.id and c.parent_email = p.parent_email and c.approved is false
    ),
    'deletion_at', p.deletion_at,
    'can_sync', public.can_sync(p.id)
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- For accounts made with Google. Only works once, so it can't be used to change an age later.
create or replace function public.set_date_of_birth(p_dob date)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_dob is null or p_dob < date '1900-01-01' or p_dob > public.today_jakarta() then
    raise exception 'invalid date of birth';
  end if;
  if public.is_too_young(p_dob) then raise exception 'too young for an account'; end if;
  update public.profiles
     set date_of_birth = p_dob, privacy_agreed_at = now()
   where id = auth.uid() and date_of_birth is null;
  return public.account_status();
end;
$$;

-- An adult fixing a typo. The new date must also make them 18 to 120, and at most once in 30 days.
-- Under-18s can never change it: that would let a child switch off the parent check.
create or replace function public.change_date_of_birth(p_dob date)
returns json language plpgsql security definer set search_path = '' as $$
declare
  cur date;
  last_change timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select date_of_birth, dob_changed_at into cur, last_change
    from public.profiles where id = auth.uid() for update;
  if cur is null then raise exception 'no date of birth yet'; end if;
  if public.is_minor(cur) then raise exception 'only adults can change the date of birth'; end if;
  if p_dob is null or p_dob < date '1900-01-01' or p_dob > public.today_jakarta()
     or extract(year from age(public.today_jakarta(), p_dob)) not between 18 and 120 then
    raise exception 'the new date must make you between 18 and 120';
  end if;
  if last_change is not null and last_change > now() - interval '30 days' then
    raise exception 'date of birth changed too recently';
  end if;
  update public.profiles set date_of_birth = p_dob, dob_changed_at = now() where id = auth.uid();
  return public.account_status();
end;
$$;

-- ─── parent-approval emails: limits that can't be raced ───────────────────────

-- Checks the limits and records the request in one step, under locks, so a burst of parallel calls can't
-- get past them. Returns 'ok', or why not: 'gap' (too soon after the last one), 'user_limit',
-- 'parent_limit' (that inbox got enough today, from any child) or 'global_limit' (the whole app's daily cap).
-- Only the request-consent function (service role) calls it.
create or replace function public.consent_take(
  p_user uuid, p_parent_email text, p_parent_key text, p_token_hash text,
  p_user_limit int, p_parent_limit int, p_global_limit int, p_gap_seconds int
) returns text language plpgsql security definer set search_path = '' as $$
declare
  n int;
  last_at timestamptz;
begin
  -- Always taken in this order, so two calls can't wait on each other.
  perform pg_advisory_xact_lock(hashtextextended('consent:global', 0));
  perform pg_advisory_xact_lock(hashtextextended('consent:user:' || p_user::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('consent:parent:' || p_parent_key, 0));

  select max(created_at) into last_at from public.consent_requests where user_id = p_user;
  if last_at is not null and last_at > now() - make_interval(secs => p_gap_seconds) then return 'gap'; end if;

  -- Requests whose email failed to send (failed_at) don't count toward the daily limits, but they do count for the gap.
  select count(*) into n from public.consent_requests
   where user_id = p_user and failed_at is null and created_at > now() - interval '24 hours';
  if n >= p_user_limit then return 'user_limit'; end if;

  select count(*) into n from public.consent_requests
   where parent_key = p_parent_key and failed_at is null and created_at > now() - interval '24 hours';
  if n >= p_parent_limit then return 'parent_limit'; end if;

  select count(*) into n from public.consent_requests where failed_at is null and created_at > now() - interval '24 hours';
  if n >= p_global_limit then return 'global_limit'; end if;

  insert into public.consent_requests (token_hash, user_id, parent_email, parent_key)
  values (p_token_hash, p_user, p_parent_email, p_parent_key);
  return 'ok';
end;
$$;

-- ─── erase accounts that never finished signing up ────────────────────────────

-- "Continue with Google" creates the account before the date of birth and the agreement are asked for.
-- If they never finish (or are under 13), the account is erased after a day. Nothing was ever synced for them.
-- Email sign-ups that never confirmed the address and never signed in are erased after a week.
-- Anything with synced data, or already being deleted, is left to its own rules.
create or replace function public.erase_unfinished_accounts()
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  delete from auth.users u
   using public.profiles p
   where p.id = u.id
     and p.deletion_at is null
     and not exists (select 1 from public.user_data d where d.user_id = u.id)
     and (
       (p.created_at < now() - interval '1 day' and (p.date_of_birth is null or public.is_too_young(p.date_of_birth)))
       or (u.email_confirmed_at is null and u.last_sign_in_at is null and p.created_at < now() - interval '7 days')
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

select cron.schedule('erase-unfinished-accounts', '27 3 * * *', 'select public.erase_unfinished_accounts()');

-- ─── clean up the birth-year version ──────────────────────────────────────────

drop function if exists public.set_birth_year(int);
drop function if exists public.is_minor(int);
alter table public.profiles drop column if exists birth_year;

-- ─── who can call what ────────────────────────────────────────────────────────

revoke execute on function public.today_jakarta(), public.is_minor(date), public.is_too_young(date) from public, anon, authenticated;
revoke execute on function public.erase_unfinished_accounts() from public, anon, authenticated;
revoke execute on function public.consent_take(uuid, text, text, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.consent_take(uuid, text, text, text, int, int, int, int) to service_role;
revoke execute on function public.set_date_of_birth(date), public.change_date_of_birth(date) from public, anon;
grant execute on function public.set_date_of_birth(date), public.change_date_of_birth(date) to authenticated;

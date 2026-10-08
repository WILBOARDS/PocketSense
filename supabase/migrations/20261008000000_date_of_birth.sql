-- Age is now decided from the full date of birth and today's date in Indonesia (Jakarta), not from the birth year.
-- Someone born in January 2008 is an adult from their 18th birthday; someone born in December 2008 is not until December.
--
-- Parent approval stays as the first migration built it (profiles.parent_email, profiles.consent_approved_at,
-- consent_requests). can_sync() needs a date of birth, no pending deletion, and either 18+ or a parent's approval.
-- Ask is 18+ only and is checked in the `ask` function, not here.
--
-- The project had no accounts when this was written, so birth_year is replaced instead of converted.
-- On a project that already has accounts, convert first: nothing here can guess a day and month.
--
-- The date of birth is never returned by account_status(), never sent to Ask, and is removed from the login
-- token's metadata as soon as the profile is created.

-- ─── column ───────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists date_of_birth date
  check (date_of_birth >= date '1900-01-01');

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

create or replace function public.can_sync(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.date_of_birth is not null
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
create or replace function public.account_status()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'has_birth_date', p.date_of_birth is not null,
    'minor', public.is_minor(p.date_of_birth),
    'parent_email', p.parent_email,
    'consent_approved', p.consent_approved_at is not null,
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
  update public.profiles
     set date_of_birth = p_dob, privacy_agreed_at = now()
   where id = auth.uid() and date_of_birth is null;
  return public.account_status();
end;
$$;

-- ─── clean up the birth-year version ──────────────────────────────────────────

drop function if exists public.set_birth_year(int);
drop function if exists public.is_minor(int);
alter table public.profiles drop column if exists birth_year;

-- ─── fewer approval emails to strangers ───────────────────────────────────────

-- request-consent also limits how many emails one parent address can get per day, across all children.
create index if not exists consent_requests_email_idx on public.consent_requests (parent_email, created_at desc);

-- ─── who can call what ────────────────────────────────────────────────────────

revoke execute on function public.today_jakarta(), public.is_minor(date) from public, anon, authenticated;
revoke execute on function public.set_date_of_birth(date) from public, anon;
grant execute on function public.set_date_of_birth(date) to authenticated;

-- Pocket Sense accounts and sync.
--
-- One row of app data per user (user_data.data holds the same JSON the phone keeps in localStorage).
-- Nothing is stored for a user until can_sync() is true: they gave a birth year, are 18+ or have
-- parent approval, and have not asked to delete their account.
-- Clients never write tables directly. Every write goes through a security-definer function below,
-- so a user can't approve their own consent or skip the checks.

-- ─── tables ───────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  birth_year int check (birth_year between 1900 and 2100),
  privacy_agreed_at timestamptz,
  parent_email text,
  consent_approved_at timestamptz,
  deletion_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- One row per parent-approval email. Only a SHA-256 hash of the link's token is kept.
create table public.consent_requests (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_email text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  approved boolean
);
create index consent_requests_user_idx on public.consent_requests (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;
alter table public.consent_requests enable row level security;

-- Users can read their own rows. There are no insert/update/delete policies on purpose.
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "read own data" on public.user_data for select to authenticated using (user_id = (select auth.uid()));
-- consent_requests: no policies. Only the Edge Functions (service role) touch it.

revoke insert, update, delete on public.profiles, public.user_data from anon, authenticated;
revoke all on public.consent_requests from anon, authenticated;

-- ─── rules ────────────────────────────────────────────────────────────────────

-- Only a birth year is collected, so someone who turns 18 later this year still counts as under 18.
-- Erring that way means asking a few 18-year-olds for approval rather than skipping it for 17-year-olds.
create or replace function public.is_minor(p_birth_year int)
returns boolean language sql immutable as $$
  select p_birth_year is null or extract(year from now())::int - p_birth_year <= 18;
$$;

create or replace function public.can_sync(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.birth_year is not null
      and p.deletion_at is null
      and (not public.is_minor(p.birth_year) or p.consent_approved_at is not null)
  );
$$;

-- ─── new users ────────────────────────────────────────────────────────────────

-- Email sign-up passes birth_year and privacy_agreed in the user metadata. Google sign-up can't,
-- so its profile starts without a birth year and the app calls set_birth_year() afterwards.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  y int;
begin
  begin
    y := (new.raw_user_meta_data ->> 'birth_year')::int;
  exception when others then
    y := null;
  end;
  if y is not null and (y < 1900 or y > extract(year from now())::int) then
    y := null;
  end if;
  insert into public.profiles (id, birth_year, privacy_agreed_at)
  values (
    new.id, y,
    case when y is not null and coalesce((new.raw_user_meta_data ->> 'privacy_agreed')::boolean, false) then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── functions the app calls ──────────────────────────────────────────────────

-- Everything the app needs to decide which screen to show after sign-in.
create or replace function public.account_status()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'birth_year', p.birth_year,
    'minor', public.is_minor(p.birth_year),
    'parent_email', p.parent_email,
    'consent_approved', p.consent_approved_at is not null,
    'deletion_at', p.deletion_at,
    'can_sync', public.can_sync(p.id)
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- For accounts made with Google. Only works once, so it can't be used to change an age later.
create or replace function public.set_birth_year(p_birth_year int)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_birth_year is null or p_birth_year < 1900 or p_birth_year > extract(year from now())::int then
    raise exception 'invalid birth year';
  end if;
  update public.profiles
     set birth_year = p_birth_year, privacy_agreed_at = now()
   where id = auth.uid() and birth_year is null;
  return public.account_status();
end;
$$;

-- Saves the app data if nobody else saved since p_base_rev (0 = first save).
-- Returns the new rev, or -1 when the server has a newer copy the app must merge first.
create or replace function public.push_data(p_data jsonb, p_base_rev bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_rev bigint;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.can_sync(uid) then raise exception 'sync not allowed for this account'; end if;
  if jsonb_typeof(p_data) <> 'object' or (p_data ->> 'version') is distinct from '1' then
    raise exception 'invalid data';
  end if;
  if octet_length(p_data::text) > 5 * 1024 * 1024 then raise exception 'data too large'; end if;

  if p_base_rev = 0 then
    insert into public.user_data (user_id, data, rev) values (uid, p_data, 1)
    on conflict (user_id) do nothing
    returning rev into new_rev;
  else
    update public.user_data
       set data = p_data, rev = rev + 1, updated_at = now()
     where user_id = uid and rev = p_base_rev
    returning rev into new_rev;
  end if;
  return coalesce(new_rev, -1);
end;
$$;

create or replace function public.cancel_deletion()
returns json language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.profiles set deletion_at = null where id = auth.uid();
  return public.account_status();
end;
$$;

revoke execute on function public.can_sync(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.account_status(), public.set_birth_year(int), public.push_data(jsonb, bigint),
  public.cancel_deletion() from public, anon;
grant execute on function public.account_status(), public.set_birth_year(int), public.push_data(jsonb, bigint),
  public.cancel_deletion() to authenticated;

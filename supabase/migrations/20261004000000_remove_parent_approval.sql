-- Removes parent approval. Everyone with a birth year can now sync; Ask stays 18+ only (checked in the ask function).
--
-- can_sync() only needs a birth year and no pending deletion. consent_requests, profiles.consent_approved_at
-- and profiles.parent_email were only used by the parent-approval functions and screens, which are gone.
-- account_status() is the only database function that read them, so it is redefined before they are dropped.

create or replace function public.can_sync(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.birth_year is not null
      and p.deletion_at is null
  );
$$;

create or replace function public.account_status()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'birth_year', p.birth_year,
    'minor', public.is_minor(p.birth_year),
    'deletion_at', p.deletion_at,
    'can_sync', public.can_sync(p.id)
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

drop table if exists public.consent_requests;
alter table public.profiles drop column if exists consent_approved_at;
alter table public.profiles drop column if exists parent_email;

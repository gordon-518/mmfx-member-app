-- Signup country + admin user-management lookup.

alter table public.profiles add column if not exists country text;

-- Extend handle_new_user to also copy country (ISO-2) from signup metadata,
-- alongside the existing full_name capture + trial seed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, full_name, country,
    signup_at, trial_ends_at, trial_count, account_status, member_status
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(upper(trim(new.raw_user_meta_data ->> 'country')), ''),
    now(),
    now() + interval '14 days',
    1,
    'trial_active',
    'inactive'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Seeds public.profiles for each new auth user: trial_active, 14-day clock, full_name + country from raw_user_meta_data. SECURITY DEFINER, search_path pinned.';

-- Admin-only exact-email lookup for the /admin user-management panel. Returns
-- 0..n rows; the caller asserts exactly one. SECURITY DEFINER so it can read
-- auth.users; internally gated on is_admin().
create or replace function public.fn_admin_find_user(p_email text)
returns table (id uuid, email text, account_status text, banned boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select u.id,
           u.email::text,
           p.account_status,
           (u.banned_until is not null and u.banned_until > now()) as banned
    from auth.users u
    left join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(p_email))
      and u.deleted_at is null;
end;
$$;

comment on function public.fn_admin_find_user(text) is
  'Admin-only exact-email user lookup for the user-management panel. SECURITY DEFINER, is_admin()-gated, search_path pinned.';

revoke all on function public.fn_admin_find_user(text) from public, anon;
grant execute on function public.fn_admin_find_user(text) to authenticated;

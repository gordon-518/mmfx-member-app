-- ============================================================================
-- Day 3 · Task 2 — auto-create profile on signup
-- A SECURITY DEFINER function + AFTER INSERT trigger on auth.users that seeds
-- the matching public.profiles row in trial_active with a 14-day clock.
--
-- SECURITY DEFINER: runs as the function owner so it can insert into
-- public.profiles regardless of the (RLS-restricted) calling context. We pin
-- search_path = '' and fully-qualify every object to prevent search_path
-- hijacking — the standard Supabase hardening for SECURITY DEFINER functions.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    signup_at,
    trial_ends_at,
    trial_count,
    account_status,
    member_status
  )
  values (
    new.id,
    new.email,
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
  'Seeds a public.profiles row for each new auth.users record: trial_active, trial_count 1, trial_ends_at = now() + 14 days. SECURITY DEFINER, own search_path pinned.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- Capture full_name on signup.
-- /signup now collects the user's name and passes it via signInWithOtp
-- options.data, which lands in auth.users.raw_user_meta_data.full_name.
-- Update handle_new_user to copy it into public.profiles.full_name (the column
-- already exists). Empty/whitespace names are stored as NULL.
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
    full_name,
    signup_at,
    trial_ends_at,
    trial_count,
    account_status,
    member_status
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
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
  'Seeds a public.profiles row for each new auth.users record: trial_active, trial_count 1, trial_ends_at = now() + 14 days, full_name from raw_user_meta_data. SECURITY DEFINER, own search_path pinned.';

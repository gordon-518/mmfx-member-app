-- ============================================================================
-- Trial-abuse signals: capture a device fingerprint + signup IP on each new
-- account so repeat trials from the same device/network/TV-account are visible
-- in /admin. Soft signals (flag, don't hard-block) to avoid false positives.
-- The fingerprint is passed in user_metadata at signup; the IP is filled in by
-- the /auth/confirm route. tradingview_username (existing) is the third signal.
-- ============================================================================
alter table public.profiles
  add column if not exists signup_fingerprint text,
  add column if not exists signup_ip text;

-- Extend handle_new_user to copy the fingerprint from signup metadata.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.profiles (
    id, email, full_name, signup_fingerprint,
    signup_at, trial_ends_at, trial_count, account_status, member_status
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'fingerprint'), ''),
    now(),
    now() + interval '14 days',
    1,
    'trial_active',
    'inactive'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

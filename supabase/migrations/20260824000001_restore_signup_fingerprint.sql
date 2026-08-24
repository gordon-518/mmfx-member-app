-- signup_fingerprint has been silently dead since 20260701_country_and_admin_
-- usermgmt.sql redefined handle_new_user() to add `country` but dropped the
-- fingerprint copy from 20260625000002_signup_abuse_signals.sql; the next
-- redefine (20260715_seven_day_trial.sql, for the trial-length change) carried
-- the regression forward. 0/2122 signups in the last 30 days have it set.
-- Restoring the fingerprint capture alongside the existing full_name/country
-- copy, unchanged otherwise.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, full_name, country, signup_fingerprint,
    signup_at, trial_ends_at, trial_count, account_status, member_status
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(upper(trim(new.raw_user_meta_data ->> 'country')), ''),
    nullif(trim(new.raw_user_meta_data ->> 'fingerprint'), ''),
    now(),
    now() + interval '7 days',
    1,
    'trial_active',
    'inactive'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Seeds public.profiles for each new auth user: trial_active, 7-day clock, full_name + country + signup_fingerprint from raw_user_meta_data. SECURITY DEFINER, search_path pinned.';

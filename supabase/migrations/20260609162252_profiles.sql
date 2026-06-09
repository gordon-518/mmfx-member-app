-- ============================================================================
-- Day 3 · Task 1 — profiles table
-- Creates public.profiles exactly per docs/SCHEMA.md.
--
-- Scope of THIS migration: table + updated_at trigger only.
--   - Signup auto-create trigger (handle_new_user)  -> later migration (Task 2)
--   - RLS enable + policies                          -> later migration (Task 3)
--   - Lazy-expiry fn_resolve_trial_status            -> later migration (Task 4)
-- RLS is intentionally NOT enabled here; it is added in the Task 3 migration.
-- ============================================================================

create table public.profiles (
  -- Identity — extends auth.users 1:1.
  id    uuid primary key references auth.users (id) on delete cascade,
  email text not null,

  full_name text,

  -- Trial clock. trial_ends_at is STORED (signup_at + 14 days), never computed.
  signup_at     timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  trial_count   integer     not null default 1,

  -- State machine + membership flags.
  account_status text not null default 'trial_active',
  member_status  text not null default 'inactive',

  -- Future activity-gating (present now, not enforced at launch).
  last_known_trading_activity timestamptz,

  -- Deposit verification. IB attribution is first-class, separate from amount.
  broker              text,
  deposit_amount      numeric,
  deposit_verified_at timestamptz,
  deposit_verified_by text,
  ib_link_confirmed   boolean not null default false,

  -- Engagement / downgrade tracking.
  last_activity_at timestamptz,
  downgraded_at    timestamptz,

  -- Row bookkeeping.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Check constraints (text + CHECK, no enum types — see SCHEMA.md).
  constraint profiles_account_status_check check (
    account_status in (
      'trial_active',
      'trial_expired',
      'member_active',
      're_trial_active',
      're_trial_expired'
    )
  ),
  constraint profiles_member_status_check check (
    member_status in ('active', 'inactive')
  ),
  constraint profiles_broker_check check (
    broker in ('octa', 'dupoin')
  ),
  constraint profiles_deposit_verified_by_check check (
    deposit_verified_by in ('manual', 'broker_postback', 'webhook')
  ),
  constraint profiles_trial_count_check check (
    trial_count >= 1 and trial_count <= 2
  )
);

comment on table public.profiles is
  'Member profiles — extends auth.users with the trial/membership state machine, deposit verification, and content-gating inputs. See docs/SCHEMA.md.';

-- ----------------------------------------------------------------------------
-- updated_at trigger — stamp updated_at = now() on every UPDATE.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

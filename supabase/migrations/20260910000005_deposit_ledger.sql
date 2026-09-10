-- ============================================================================
-- Conversion-fix 3.1 — a deposit ledger, a cumulative total, and an explicit
-- grandfather flag.
--
-- Tiers gate on CUMULATIVE verified deposits (decision 5, a high-water mark,
-- never balance). Today profiles.deposit_amount holds one number that
-- fn_verify_deposit overwrites, and a top-up can't be recorded at all. From
-- here on:
--   * deposit_events is the ledger: one row per verified deposit.
--   * profiles.deposit_amount = sum(deposit_events.amount) for the user,
--     maintained by the verify RPC (task 3.2), never computed on the fly.
--   * profiles.grandfathered marks the 112 Softr-era members, who get Team MM
--     and must never be downgraded (decision 6). Before this, "legacy" was
--     inferred from member_active + deposit_verified_at IS NULL.
--
-- Additive + idempotent: safe to re-run. The backfill inserts one row per
-- verified member only if that member has no ledger row yet, and the flag
-- update only touches rows not already flagged.
-- ============================================================================


create table if not exists public.deposit_events (
  id            bigint generated always as identity primary key,
  user_id       uuid          not null references public.profiles(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  broker        text          not null check (broker in ('octa', 'dupoin', 'elev8')),
  ib_confirmed  boolean       not null,
  -- The admin who verified it. Null for backfilled rows: the old flow only
  -- recorded the string 'manual', not who.
  verified_by   uuid          references public.profiles(id) on delete set null,
  verified_at   timestamptz   not null default now(),
  note          text,
  created_at    timestamptz   not null default now()
);

create index if not exists deposit_events_user_verified_idx
  on public.deposit_events (user_id, verified_at);

comment on table public.deposit_events is
  'Verified-deposit ledger (conversion-fix 3.1). profiles.deposit_amount is the per-user sum, maintained by fn_verify_deposit. Admin SELECT only; written only by fn_verify_deposit.';

alter table public.deposit_events enable row level security;

revoke all on public.deposit_events from anon, authenticated;
grant select on public.deposit_events to authenticated;

drop policy if exists "deposit_events_select_admin" on public.deposit_events;
create policy "deposit_events_select_admin"
  on public.deposit_events
  for select
  to authenticated
  using ( public.is_admin() );


alter table public.profiles
  add column if not exists grandfathered boolean not null default false;

comment on column public.profiles.grandfathered is
  'Softr-era member migrated without a deposit record. Always Team MM; never downgraded by tier logic (conversion-fix decision 6). Set once by 20260910000005.';


-- Backfill: each verified member's current deposit_amount becomes their first
-- (and so far only) ledger row, so sum(amount) = deposit_amount holds from day one.
insert into public.deposit_events (user_id, amount, broker, ib_confirmed, verified_by, verified_at, note)
select p.id, p.deposit_amount, p.broker, coalesce(p.ib_link_confirmed, false), null, p.deposit_verified_at,
       'Backfilled from profiles.deposit_amount (conversion-fix 3.1)'
from public.profiles p
where p.deposit_verified_at is not null
  and not exists (select 1 from public.deposit_events e where e.user_id = p.id);


update public.profiles p
set grandfathered = true
where p.account_status = 'member_active'
  and p.deposit_verified_at is null
  and not p.grandfathered;

-- ============================================================================
-- Conversion-fix 5.1 / 5.4 — in-app deposit submission.
--
-- A member (or trial / Free user) submits their deposit from /upgrade:
-- broker, trading account number, amount, TradingView username and a
-- screenshot. The screenshot goes to the PRIVATE `deposit-proofs` bucket, in
-- the user's own folder; only admins can read it. Each submission is a
-- `deposit_submissions` row that an admin reviews (5.2). Verify goes through
-- fn_verify_deposit, so tiers, the ledger and top-ups all behave as in Phase 3.
-- A paid member's submission is a top-up through the same queue (5.4).
--
-- Additive. The two event/funnel functions are re-created from their current
-- bodies with only the marked changes.
-- ============================================================================


-- ─── The private proof bucket ───────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('deposit-proofs', 'deposit-proofs', false)
on conflict (id) do update set public = excluded.public;

-- Upload: own folder only ("<auth.uid()>/<file>"). No update or delete, so a
-- proof can't be swapped after it's submitted.
drop policy if exists "deposit_proofs_insert_own" on storage.objects;
create policy "deposit_proofs_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'deposit-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Read: admins only (the review queue).
drop policy if exists "deposit_proofs_select_admin" on storage.objects;
create policy "deposit_proofs_select_admin"
  on storage.objects
  for select
  to authenticated
  using ( bucket_id = 'deposit-proofs' and public.is_admin() );


-- ─── Submissions ────────────────────────────────────────────────────────────

create table if not exists public.deposit_submissions (
  id                      uuid          primary key default gen_random_uuid(),
  user_id                 uuid          not null references public.profiles(id) on delete cascade,
  broker                  text          not null check (broker in ('octa', 'dupoin', 'elev8')),
  trading_account_number  text          not null check (trading_account_number ~ '^[0-9]{4,20}$'),
  amount                  numeric(12,2) not null check (amount >= 50),
  tradingview_username    text,
  proof_path              text          not null,
  status                  text          not null default 'pending'
                                        check (status in ('pending', 'verified', 'rejected')),
  reject_reason           text,
  reviewed_by             uuid          references public.profiles(id) on delete set null,
  reviewed_at             timestamptz,
  created_at              timestamptz   not null default now()
);

create index if not exists deposit_submissions_status_created_idx
  on public.deposit_submissions (status, created_at);
create index if not exists deposit_submissions_user_created_idx
  on public.deposit_submissions (user_id, created_at desc);

-- At most one pending submission per user, enforced by the database.
create unique index if not exists deposit_submissions_one_pending_idx
  on public.deposit_submissions (user_id) where status = 'pending';

comment on table public.deposit_submissions is
  'In-app deposit submissions (conversion-fix 5.1). Users read their own; admins read all. Written only by fn_submit_deposit (insert) and the admin review RPC (5.2).';

alter table public.deposit_submissions enable row level security;

revoke all on public.deposit_submissions from anon, authenticated;
grant select on public.deposit_submissions to authenticated;

drop policy if exists "deposit_submissions_select_own" on public.deposit_submissions;
create policy "deposit_submissions_select_own"
  on public.deposit_submissions
  for select
  to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists "deposit_submissions_select_admin" on public.deposit_submissions;
create policy "deposit_submissions_select_admin"
  on public.deposit_submissions
  for select
  to authenticated
  using ( public.is_admin() );


-- The only way a user creates a submission. Validates everything the admin
-- would otherwise have to catch by eye, and logs deposit_submitted for the
-- /stats funnel (the phase's "done when").
create or replace function public.fn_submit_deposit(
  p_broker                 text,
  p_trading_account_number text,
  p_amount                 numeric,
  p_tradingview_username   text,
  p_proof_path             text
)
returns public.deposit_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  account text := nullif(btrim(p_trading_account_number), '');
  tv      text := nullif(btrim(p_tradingview_username), '');
  result  public.deposit_submissions;
begin
  if uid is null then
    raise exception 'fn_submit_deposit: no authenticated user';
  end if;

  if p_broker is null or p_broker not in ('octa', 'dupoin', 'elev8') then
    raise exception 'Choose your broker: Octa, Dupoin or Elev8';
  end if;

  if account is null or account !~ '^[0-9]{4,20}$' then
    raise exception 'Enter your trading account number (digits only)';
  end if;

  if p_amount is null or p_amount < 50 then
    raise exception 'The minimum deposit is $50';
  end if;

  if tv is not null and tv !~ '^[A-Za-z0-9_]{2,30}$' then
    raise exception 'Enter your TradingView username (the @handle), or leave it blank';
  end if;

  -- The proof must be a file this user uploaded to their own folder.
  if p_proof_path is null
     or split_part(p_proof_path, '/', 1) <> uid::text
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'deposit-proofs' and o.name = p_proof_path
     ) then
    raise exception 'Upload a screenshot of your deposit';
  end if;

  if exists (
    select 1 from public.deposit_submissions s
    where s.user_id = uid and s.status = 'pending'
  ) then
    raise exception 'You already have a deposit waiting for review';
  end if;

  insert into public.deposit_submissions
    (user_id, broker, trading_account_number, amount, tradingview_username, proof_path)
  values
    (uid, p_broker, account, p_amount, tv, p_proof_path)
  returning * into result;

  perform public.fn_app_event_insert(
    uid, 'deposit_submitted', jsonb_build_object('amount', p_amount, 'broker', p_broker)
  );

  return result;
end;
$$;

revoke all on function public.fn_submit_deposit(text, text, numeric, text, text) from public, anon;
grant execute on function public.fn_submit_deposit(text, text, numeric, text, text) to authenticated;


-- ─── Event allowlist: + deposit_submitted (from 20260910000007) ─────────────

create or replace function public.fn_app_event_insert(
  p_user_id uuid,
  p_event   text,
  p_props   jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- v_ prefix: a bare "props" is ambiguous with app_events.props in the
  -- dedupe query below and makes every call fail.
  v_props jsonb := coalesce(p_props, '{}'::jsonb);
begin
  if p_user_id is null then
    raise exception 'fn_app_event_insert: user id required';
  end if;

  if p_event is null or p_event not in (
    'feature_view',
    'tv_username_set',
    'upgrade_viewed',
    'upgrade_broker_link_clicked',
    'upgrade_contact_clicked',
    'deposit_verified',
    'tier_changed',
    'onboarding_step_done',
    'deposit_submitted'   -- added (5.1)
  ) then
    raise exception 'fn_app_event_insert: event % is not on the allowlist', p_event;
  end if;

  if jsonb_typeof(v_props) <> 'object' then
    raise exception 'fn_app_event_insert: props must be a JSON object';
  end if;

  if pg_column_size(v_props) > 1024 then
    raise exception 'fn_app_event_insert: props exceed 1 KB';
  end if;

  -- One feature_view per user + feature per 30 minutes. Refreshes and
  -- back-navigation would otherwise bury the signal under duplicate rows.
  if p_event = 'feature_view' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'feature_view'
      and e.props ->> 'feature' = v_props ->> 'feature'
      and e.created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  -- A checklist step is done once; later repeats are no-ops.
  if p_event = 'onboarding_step_done' and exists (
    select 1
    from public.app_events e
    where e.user_id = p_user_id
      and e.event = 'onboarding_step_done'
      and e.props ->> 'step' = v_props ->> 'step'
  ) then
    return;
  end if;

  insert into public.app_events (user_id, event, props)
  values (p_user_id, p_event, v_props);
end;
$$;

revoke all on function public.fn_app_event_insert(uuid, text, jsonb)
  from public, anon, authenticated;


-- ─── /stats funnel: + deposit_submitted step (from 20260910000002) ──────────

create or replace function public.fn_admin_funnel_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  days     integer     := greatest(1, least(coalesce(p_days, 30), 365));
  since    timestamptz := now() - make_interval(days => days);
  -- Neither activation signal existed before this instant.
  tracked  constant timestamptz := '2026-09-10 00:00:00+08';
  out      jsonb;
begin
  if not public.is_admin() then
    raise exception 'fn_admin_funnel_stats: admins only';
  end if;

  with cohort as (
    select p.id, p.signup_at, p.tv_connected_at, p.deposit_verified_at
    from public.profiles p
    where p.signup_at >= greatest(since, tracked)
      and p.signup_at <= now() - interval '48 hours'
      and not (p.account_status = 'member_active' and p.deposit_verified_at is null)
  ),
  flags as (
    select
      c.deposit_verified_at,
      (c.tv_connected_at is not null
        and c.tv_connected_at <= c.signup_at + interval '48 hours') as tv48,
      exists (
        select 1
        from public.app_events e
        where e.user_id = c.id
          and e.event = 'feature_view'
          and e.props ->> 'feature' = 'daily-analysis'
          and e.created_at <= c.signup_at + interval '48 hours'
      ) as da48
    from cohort c
  ),
  steps as (
    select e.event, count(distinct e.user_id) as users
    from public.app_events e
    where e.created_at >= since
      and e.event in (
        'upgrade_viewed',
        'upgrade_broker_link_clicked',
        'upgrade_contact_clicked',
        'deposit_submitted',   -- added (5.1)
        'deposit_verified'
      )
    group by e.event
  )
  select jsonb_build_object(
    'days',                   days,
    'cohort',                 (select count(*) from flags),
    'activated',              (select count(*) from flags where tv48 and da48),
    'tv48',                   (select count(*) from flags where tv48),
    'da48',                   (select count(*) from flags where da48),
    'activated_verified',     (select count(*) from flags
                                where tv48 and da48 and deposit_verified_at is not null),
    'not_activated_verified', (select count(*) from flags
                                where not (tv48 and da48) and deposit_verified_at is not null),
    'funnel',                 coalesce((select jsonb_object_agg(event, users) from steps),
                                       '{}'::jsonb)
  )
  into out;

  return out;
end;
$$;

revoke all on function public.fn_admin_funnel_stats(integer) from public, anon;
grant execute on function public.fn_admin_funnel_stats(integer) to authenticated;

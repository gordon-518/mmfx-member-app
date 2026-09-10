-- ============================================================================
-- Conversion-fix 3.2 — fn_verify_deposit handles the tier ladder and top-ups.
--
-- Before: rejected anything under $500, rejected anyone already a member (so a
-- top-up couldn't be recorded at all), and OVERWROTE deposit_amount.
-- After:
--   * minimum $50 per verified deposit (Foundation's threshold)
--   * an existing member can be verified again: that's a top-up
--   * every verification writes one deposit_events row, and deposit_amount
--     becomes the running sum (the tier high-water mark)
--   * deposit_verified_at keeps the FIRST verification time. It's the
--     conversion timestamp the growth metrics count; a top-up must not move it
--   * the partnered-broker and IB-confirmed checks are unchanged
--   * the first deposit flips trial_* -> member_active exactly as before
--   * the same amount + broker for the same user within 2 minutes is refused
--     as a double submit
--
-- Body: the LIVE definition (pg_get_functiondef, 10 Sep 2026) with the marked
-- changes. Signature and return type unchanged, so existing grants persist.
--
-- Also extends the app_events allowlist with tier_changed (plan 1.3: "later
-- phases add tier_changed"). fn_app_event_insert is re-created from its body in
-- 20260910000002, with only the list changed.
-- ============================================================================

create or replace function public.fn_verify_deposit(
  target_user_id uuid,
  p_broker text,
  p_amount numeric,
  p_ib_confirmed boolean
)
returns public.profiles
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'fn_verify_deposit: caller is not an admin';
  end if;

  -- changed (3.2): $50 is the lowest qualifying deposit (Foundation).
  if p_amount is null or p_amount < 50 then
    raise exception 'Deposit does not qualify: amount is below $50';
  end if;

  if p_broker is null or p_broker not in ('octa', 'dupoin', 'elev8') then
    raise exception 'Deposit does not qualify: broker must be a partnered broker (octa, dupoin or elev8)';
  end if;

  if p_ib_confirmed is not true then
    raise exception 'Deposit does not qualify: IB link attribution not confirmed';
  end if;

  select p.* into target
  from public.profiles p
  where p.id = target_user_id
  for update;

  if target.id is null then
    raise exception 'No profile found for user %', target_user_id;
  end if;

  -- changed (3.2): an existing member is no longer rejected. Verifying them
  -- again records a top-up.

  -- added (3.2 review): double-submit guard. Dropping the "already a member"
  -- rejection removed the only thing stopping a double-clicked Verify from
  -- recording the same deposit twice and inflating the tier. The FOR UPDATE
  -- above serialises concurrent verifies for this user, so a second submit
  -- waits, then sees the first one's ledger row here.
  if exists (
    select 1
    from public.deposit_events e
    where e.user_id = target_user_id
      and e.amount = p_amount
      and e.broker = p_broker
      and e.verified_at > now() - interval '2 minutes'
  ) then
    raise exception 'Looks like a duplicate: a $% % deposit for this user was verified in the last 2 minutes', p_amount, p_broker;
  end if;

  -- added (3.2): the ledger row. The running total below is derived from it.
  insert into public.deposit_events (user_id, amount, broker, ib_confirmed, verified_by, verified_at)
  values (target_user_id, p_amount, p_broker, true, (select auth.uid()), now());

  update public.profiles p
  set
    account_status      = 'member_active',
    member_status       = 'active',
    broker              = p_broker,
    -- changed (3.2): cumulative, never overwritten.
    deposit_amount      = coalesce(p.deposit_amount, 0) + p_amount,
    ib_link_confirmed   = true,
    -- changed (3.2): the first verification's time sticks; top-ups don't move it.
    deposit_verified_at = coalesce(p.deposit_verified_at, now()),
    deposit_verified_by = 'manual',
    downgraded_at       = null,
    trial_ends_at       = null
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$function$;


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
    'tier_changed'   -- added (3.2)
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

  insert into public.app_events (user_id, event, props)
  values (p_user_id, p_event, v_props);
end;
$$;

revoke all on function public.fn_app_event_insert(uuid, text, jsonb)
  from public, anon, authenticated;

-- ============================================================================
-- Conversion-fix Phase 6 — US/UK lifetime plans.
--
-- The partnered brokers can't take US/UK clients, so those traders pay once
-- instead of depositing through our IB:
--   team             Team MM Access          USD 588   (everything in Team MM
--                                                        except the full course)
--   team_mentorship  Team MM + Mentorship    USD 1,588 (everything)
-- Payment is arranged over WhatsApp/Telegram; an admin then grants the plan.
-- A lifetime member is member_active at the Team MM tier, needs no trading
-- account number (they don't use our brokers), and can't use the AI Trading
-- Assistant without one, since it connects the account on file.
--
-- Additive. fn_admin_grant_lifetime is the only writer of these columns.
-- ============================================================================

alter table public.profiles
  add column if not exists lifetime_plan text
    check (lifetime_plan in ('team', 'team_mentorship')),
  add column if not exists lifetime_granted_at timestamptz;

comment on column public.profiles.lifetime_plan is
  'US/UK lifetime plan (conversion-fix Phase 6): team (USD 588, Team MM without the full course) or team_mentorship (USD 1,588). Set only by fn_admin_grant_lifetime.';
comment on column public.profiles.lifetime_granted_at is
  'When the lifetime plan was first granted. An upgrade to team_mentorship keeps the original date.';


create or replace function public.fn_admin_grant_lifetime(
  target_user_id uuid,
  p_plan         text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'fn_admin_grant_lifetime: caller is not an admin';
  end if;

  if p_plan is null or p_plan not in ('team', 'team_mentorship') then
    raise exception 'Choose a lifetime plan: team or team_mentorship';
  end if;

  select p.* into target
  from public.profiles p
  where p.id = target_user_id
  for update;

  if target.id is null then
    raise exception 'No profile found for user %', target_user_id;
  end if;

  -- A paid plan is never taken away here: Mentorship can't drop to Team only.
  if target.lifetime_plan = 'team_mentorship' and p_plan = 'team' then
    raise exception 'This member already has Team MM + Mentorship';
  end if;

  update public.profiles p
  set account_status      = 'member_active',
      member_status       = 'active',
      lifetime_plan       = p_plan,
      lifetime_granted_at = coalesce(p.lifetime_granted_at, now()),
      trial_ends_at       = null,
      downgraded_at       = null
  where p.id = target_user_id
  returning p.* into target;

  return target;
end;
$$;

revoke all on function public.fn_admin_grant_lifetime(uuid, text) from public, anon;
grant execute on function public.fn_admin_grant_lifetime(uuid, text) to authenticated;

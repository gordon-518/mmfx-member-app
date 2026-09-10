-- ============================================================================
-- Conversion-fix Phase 0.1 — separate verified members from legacy members.
--
-- growth_daily.members_active counts every member_active profile, and 112 of
-- them (as of 10 Sep 2026) are grandfathered Softr members with no deposit
-- record. They inflated every conversion figure roughly 4x. These two columns
-- let the daily snapshot record the split.
--
-- NULLABLE on purpose, with no default: snapshots taken before this change did
-- not measure the split, and a 0 there would be a false reading. Null means
-- "not measured". (growth_daily's original columns are NOT NULL; a new metric
-- column must not be, or old snapshots can't coexist with it.)
--
-- Additive only. Written by the daily-stats cron (service role).
-- ============================================================================

alter table public.growth_daily
  add column if not exists members_verified integer,
  add column if not exists members_legacy   integer;

comment on column public.growth_daily.members_verified is
  'member_active profiles WITH a verified deposit (deposit_verified_at set): the real conversions. Null before 2026-09-10 (not measured).';
comment on column public.growth_daily.members_legacy is
  'member_active profiles with NO deposit record: grandfathered Softr members. Null before 2026-09-10 (not measured).';

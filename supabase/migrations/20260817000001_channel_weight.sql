-- ============================================================================
-- MM Channel Bot — advertising weight per post.
--
-- The rotation was equal-opportunity: the Economic Calendar got as much airtime
-- as the flagship. `weight` reflects how hard a feature should be pushed
-- (MMFeatures.md tiering) — a weight-4 post becomes due roughly 4x sooner than
-- a weight-1 post, while the engagement optimiser still sorts within a tier.
-- ============================================================================

alter table public.content_library
  add column if not exists weight integer not null default 1;

comment on column public.content_library.weight is
  'Advertising weight: 4=flagship, 3=core proof, 2=supporting, 1=light touch. Scales how often the post is selected by the 4-hourly rotation.';

-- Guard against a typo silently starving or flooding the channel.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'content_library_weight_range'
  ) then
    alter table public.content_library
      add constraint content_library_weight_range check (weight between 1 and 5);
  end if;
end $$;

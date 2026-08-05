-- ============================================================================
-- MM Channel Bot — CTA Engine engagement layer.
--  channel_posts   : per-post click + reaction counts, and the inline button set
--  content_library : the button set each library item carries
--  increment_post_clicks(uuid) : atomic click counter (called by the /go redirect)
--  library_engagement : per-library-item rollup used by the self-optimizing loop
-- ============================================================================

alter table public.channel_posts   add column if not exists clicks     integer not null default 0;
alter table public.channel_posts   add column if not exists reactions  integer not null default 0;
alter table public.channel_posts   add column if not exists button_set jsonb;
alter table public.content_library add column if not exists button_set jsonb;

-- Atomic click increment. security definer so the service-role route can call it
-- without widening table grants. Locked from anon/authenticated.
create or replace function public.increment_post_clicks(post_id uuid)
returns void language sql security definer as $$
  update public.channel_posts set clicks = clicks + 1, updated_at = now() where id = post_id;
$$;
revoke all on function public.increment_post_clicks(uuid) from anon, authenticated;

-- Per-item engagement rollup for the optimizer (impressions / clicks / reactions).
create or replace view public.library_engagement as
  select source_id            as item_id,
         count(*)::int        as impressions,
         coalesce(sum(clicks), 0)::int    as clicks,
         coalesce(sum(reactions), 0)::int as reactions
  from public.channel_posts
  where kind = 'library' and source_id is not null
  group by source_id;

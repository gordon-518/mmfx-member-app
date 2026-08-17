-- ============================================================================
-- MM Channel Bot — admin read access for the performance dashboard.
--
-- These tables are service-role-write only and were revoked from every browser
-- role. The dashboard needs an admin to READ them, so grant select + an
-- is_admin() policy, exactly as growth_daily does. Writes stay service-role.
-- ============================================================================

grant select on public.channel_posts   to authenticated;
grant select on public.content_library to authenticated;
grant select on public.visual_library  to authenticated;
grant select on public.library_engagement to authenticated;

drop policy if exists "channel_posts_select_admin" on public.channel_posts;
create policy "channel_posts_select_admin"
  on public.channel_posts for select to authenticated using ( public.is_admin() );

drop policy if exists "content_library_select_admin" on public.content_library;
create policy "content_library_select_admin"
  on public.content_library for select to authenticated using ( public.is_admin() );

drop policy if exists "visual_library_select_admin" on public.visual_library;
create policy "visual_library_select_admin"
  on public.visual_library for select to authenticated using ( public.is_admin() );

-- The rollup view runs with the querying user's rights, so the policies above
-- govern it too. Keep it invoker-rights explicitly (PG15+ default is invoker).
alter view public.library_engagement set (security_invoker = on);

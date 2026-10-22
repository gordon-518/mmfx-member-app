-- ============================================================================
-- Course progress, server-side (22 Oct).
--
-- The player kept watched lessons in localStorage only, so progress vanished
-- when a member opened the app on their phone. The dashboard's skill track
-- shows how far through the system they are, and that has to be true of the
-- member, not of the browser.
--
-- Union semantics: the player only ever marks a lesson watched, so a save
-- adds to the set and never shrinks it. A device that has been offline can't
-- wipe progress made elsewhere.
-- ============================================================================

alter table public.profiles
  add column if not exists course_watched text[] not null default '{}';

comment on column public.profiles.course_watched is
  'Lesson slugs the member has watched (union-merged by fn_save_course_progress).';

create or replace function public.fn_save_course_progress(p_slugs text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  cleaned text[];
  merged  text[];
begin
  if uid is null then
    raise exception 'fn_save_course_progress: no authenticated user';
  end if;

  if p_slugs is null or array_length(p_slugs, 1) is null then
    return (select p.course_watched from public.profiles p where p.id = uid);
  end if;

  -- The slugs come from the browser: bound the count, and accept only the
  -- shape courseData.ts uses, so this column can't become free-text storage.
  if array_length(p_slugs, 1) > 100 then
    raise exception 'fn_save_course_progress: too many slugs';
  end if;

  select array_agg(distinct s)
    into cleaned
    from unnest(p_slugs) s
   where s ~ '^[a-z0-9][a-z0-9-]{0,63}$';

  select array_agg(distinct x)
    into merged
    from (
      select unnest(coalesce(p.course_watched, '{}'::text[])) x
        from public.profiles p where p.id = uid
      union
      select unnest(coalesce(cleaned, '{}'::text[]))
    ) u;

  update public.profiles
     set course_watched = coalesce(merged, '{}'::text[])
   where id = uid;

  return coalesce(merged, '{}'::text[]);
end;
$$;

revoke all on function public.fn_save_course_progress(text[]) from public, anon;
grant execute on function public.fn_save_course_progress(text[]) to authenticated;

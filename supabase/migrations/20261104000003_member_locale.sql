-- ============================================================================
-- Emails in the member's language (Gordon, 4 Nov 2026).
--   * fn_user_locales(uuid[]): the saved language (user_metadata.locale) for a
--     batch of members, in one round trip. The email crons need it, the claim
--     functions don't return it, and PostgREST can't reach auth.users.
--   * fn_adopt_locale(uuid, text): saves the language the app is showing a
--     member who never picked one (the proxy calls it), so their emails match
--     the app they read. It never overwrites a saved choice.
--   * email_sends.locale: the language a lifecycle email went out in, so a
--     variant's KPIs can be read for English sends alone (the challenger arms
--     are English; other languages get the translated default).
-- Additive: two functions (service role only) and one nullable column.
-- ============================================================================

create or replace function public.fn_user_locales(p_ids uuid[])
returns table (user_id uuid, locale text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.raw_user_meta_data->>'locale'
    from auth.users u
   where u.id = any(p_ids)
     and u.raw_user_meta_data->>'locale' in ('en', 'zh-Hans', 'zh-Hant', 'ms', 'id');
$$;

revoke all on function public.fn_user_locales(uuid[]) from public, anon, authenticated;
grant execute on function public.fn_user_locales(uuid[]) to service_role;

-- True when it saved the language; false when one was already saved (or the
-- value isn't a language the app speaks).
create or replace function public.fn_adopt_locale(p_user uuid, p_locale text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_locale is null or p_locale not in ('en', 'zh-Hans', 'zh-Hant', 'ms', 'id') then
    return false;
  end if;
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('locale', p_locale)
   where id = p_user
     and not (coalesce(raw_user_meta_data, '{}'::jsonb) ? 'locale');
  return found;
end;
$$;

revoke all on function public.fn_adopt_locale(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_adopt_locale(uuid, text) to service_role;

alter table public.email_sends add column if not exists locale text;
comment on column public.email_sends.locale is
  'The language this send went out in (null before 4 Nov 2026). Challenger arms are English only: other languages get the translated default and record variant A.';

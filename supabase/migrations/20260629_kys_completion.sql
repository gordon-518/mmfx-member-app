-- KYS completion tracking. Set when a user emails themselves their result via
-- the Know Your Style bot ("Send me a copy"). Drives the dashboard onboarding
-- hero (hidden once completed).
alter table public.profiles
  add column if not exists kys_completed_at timestamptz,
  add column if not exists kys_archetype text;

-- Mark the calling user's KYS as complete. coalesce keeps the first-completion
-- timestamp stable across re-takes. SECURITY DEFINER + pinned search_path +
-- fully-qualified objects (repo hardening standard).
create or replace function public.fn_mark_kys_completed(p_archetype text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set kys_completed_at = coalesce(kys_completed_at, now()),
         kys_archetype    = nullif(left(trim(p_archetype), 120), '')
   where id = (select auth.uid());
end;
$$;

comment on function public.fn_mark_kys_completed(text) is
  'Marks the calling user''s KYS complete (stable first-completion time). Called by /api/kys/send-copy. SECURITY DEFINER, search_path pinned.';

revoke all on function public.fn_mark_kys_completed(text) from public, anon;
grant execute on function public.fn_mark_kys_completed(text) to authenticated;

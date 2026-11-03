-- ============================================================================
-- In-app support chat: hardening after the security review (4 Nov 2026).
--   * chat_threads.busy_until + fn_chat_claim: one request at a time per
--     member, with the hourly message limit checked inside the same atomic
--     claim. Without it a burst of parallel requests slipped past the limit,
--     the alert throttle and the daily budget, which were check-then-act.
--   * Reads are admin-only. Members read their own thread through /api/chat
--     (the service role), so they never needed direct SELECT, which exposed
--     internal columns (model, guard failures, handoff reason, staff id).
--   * A second nightly job clears handoff reasons older than 180 days, in
--     step with the message purge.
-- Additive: one nullable column, one function, two policies replaced with
-- stricter ones on tables that are still empty, one cron job.
-- ============================================================================

alter table public.chat_threads add column if not exists busy_until timestamptz;

-- Returns 'ok' (the caller now holds the member's claim and must release it
-- by clearing busy_until), 'busy' (another request for this member is in
-- flight) or 'rate_limited' (p_hour_limit member messages in the last hour).
-- The claim expires on its own after 100s, past /api/chat's maxDuration, so
-- a request killed mid-flight can't lock a member out.
create or replace function public.fn_chat_claim(p_user uuid, p_locale text, p_hour_limit int)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.chat_threads (user_id, locale) values (p_user, p_locale)
    on conflict (user_id) do update set locale = excluded.locale;

  update public.chat_threads
     set busy_until = now() + interval '100 seconds'
   where user_id = p_user
     and (busy_until is null or busy_until < now());
  if not found then
    return 'busy';
  end if;

  if (select count(*) from public.chat_messages
       where user_id = p_user
         and role = 'member'
         and created_at > now() - interval '1 hour') >= p_hour_limit then
    update public.chat_threads set busy_until = null where user_id = p_user;
    return 'rate_limited';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.fn_chat_claim(uuid, text, int) from public, anon, authenticated;
grant execute on function public.fn_chat_claim(uuid, text, int) to service_role;

-- Reads: admins only (members go through /api/chat).
drop policy if exists "chat_threads_select_own_or_admin" on public.chat_threads;
drop policy if exists "chat_messages_select_own_or_admin" on public.chat_messages;
drop policy if exists "chat_threads_select_admin" on public.chat_threads;
create policy "chat_threads_select_admin" on public.chat_threads
  for select to authenticated using ( (select public.is_admin()) );
drop policy if exists "chat_messages_select_admin" on public.chat_messages;
create policy "chat_messages_select_admin" on public.chat_messages
  for select to authenticated using ( (select public.is_admin()) );

-- Handoff reasons can quote the member; clear them on the messages' schedule.
select cron.schedule(
  'chat-threads-purge',
  '50 0 * * *',
  $$update public.chat_threads set handoff_reason = null
     where handoff_reason is not null and updated_at < now() - interval '180 days'$$
);

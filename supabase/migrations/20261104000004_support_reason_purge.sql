-- ============================================================================
-- Support agent: old handoff reasons are cleared, in step with the in-app
-- chat (4 Nov 2026). support_events is purged after 90 days
-- (20260915000010), but support_chats.handoff_reason, which can carry the
-- model's one-line reading of what a member wrote, stayed forever. A nightly
-- job clears it on chats untouched for 90 days — never on a chat still
-- waiting for Amelia, whose queue shows the reason.
-- Additive: one cron job.
-- ============================================================================

select cron.schedule(
  'support-chats-reason-purge',
  '40 0 * * *',
  $$update public.support_chats set handoff_reason = null
     where handoff_reason is not null
       and state <> 'needs_amelia'
       and updated_at < now() - interval '90 days'$$
);

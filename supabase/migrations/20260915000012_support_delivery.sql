-- Support agent: mark which logged outgoing messages actually reached SendPulse.
-- The reply row is written BEFORE the send (so the agent recognises its own echo),
-- so without this a run killed between the two looks like a delivered reply.
alter table public.support_events
  add column if not exists delivered_at timestamptz;

comment on column public.support_events.delivered_at is
  'Set once SendPulse confirmed the send. A reply or handoff row with a null delivered_at was logged but never confirmed.';

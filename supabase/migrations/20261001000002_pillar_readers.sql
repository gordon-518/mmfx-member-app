-- ============================================================================
-- Command Center pillar readers, as functions.
--
-- WHY. The collector (mmfx-brain, agents/command/collect.ts) runs on the VPS inside
-- openclaw-openclaw-gateway-1, on cron, alongside the email and organic loops. Until now
-- its three SQL-backed pillars reached Postgres through the Supabase MANAGEMENT API with a
-- personal access token. The VPS does not have one and should not: a management token can
-- do anything to the project, including delete it, and that box also runs n8n and a public
-- gateway. What the VPS does have is SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
--
-- So each pillar's query becomes a security-definer function granted to service_role and
-- called over /rest/v1/rpc — exactly the pattern organic_signups_by_cid already uses. No
-- new credential is created or moved anywhere.
--
-- THE COLUMN NAMES ARE A CONTRACT with the brain's readers. Renaming one does not fail
-- loudly: rowNum() throws on the missing column, the runner converts that to a `stale`
-- row, and the pillar silently goes blank. If a column has to change, change the reader
-- in the same commit.
--
-- The comments inside each body are carried over verbatim from the brain's .sql files on
-- purpose. They record which production column each number rests on, which candidates were
-- rejected and the row counts that killed them. That reasoning is the only thing standing
-- between this file and the class of bug it was written to fix — a KPI pointed at a table
-- nobody writes to.
--
-- Nothing here reads or writes a row outside these selects. Dry-run with begin … rollback
-- before applying, as with the email, partner and seo migrations.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- fn_pillar_webapp — signups, activation, live trials, deposits, deposit value.
--
-- activation_rate: app_events.event = 'onboarding_step_done' was the first candidate and
-- was REJECTED — it has fired 18 times total, across 18 users, in the table's lifetime
-- (2026-10-01). Scoring activation on it pins the number at ~2.1% forever regardless of
-- what members do: a measurement artifact wearing a business-fact costume, and the pillar
-- would read `bad` every day on a dead event rather than on a real change. A profile counts
-- as activated if ANY of: kys_completed_at set, tradingview_username set, or an app_events
-- row with event <> 'email_visit'. email_visit is excluded deliberately — clicking a link
-- in an email is not an in-app action, and counting it would let the email programme
-- inflate webapp's own KPI. On the 30-day cohort this measures ~42.9% (203/473); measured
-- lifetime it gives ~16.9% (716/4248), which reproduces the business's own documented
-- baseline ("82% of signups did zero onboarding steps") — the cross-check that gives
-- confidence this is the right definition rather than a flattering one.
--
-- trials_active: every profile has trial_count > 0 and trial_ends_at is stamped at signup,
-- so "trials started this week" is mechanically identical to signups_7d — a KPI that only
-- restates another. Replaced with a POINT-IN-TIME count of profiles currently inside their
-- window (account_status = 'trial_active'). Unlike every other column here it is not a
-- 7-day window, because what the no-deposits finding needs to know is whether a live
-- population could still convert.
--
-- deposits: deposit_submissions was the first candidate and was REJECTED — 4 rows
-- lifetime, 1 verified (2026-10-01). It is a form members fill in manually and most
-- verified deposits never produce a row. profiles.deposit_verified_at / deposit_amount are
-- what an admin actually stamps, and had 40 lifetime / 6 in the trailing 30 days on the
-- same date, roughly 6x what deposit_submissions would have reported. The money KPI this
-- whole system ranks on cannot come from a table nobody writes to. deposits_28d exists
-- because the trailing base rate is ~2.4/week (39 over 16 weeks), so a plain 7-day zero is
-- ordinary sparsity rather than a drought. deposit_usd_7d is the real IB revenue driver:
-- IB is a fraction of deposited VALUE, not of deposit count.
-- ---------------------------------------------------------------------------
create or replace function public.fn_pillar_webapp()
returns table (
  signups_7d       bigint,
  activation_rate  numeric,
  trials_active    bigint,
  deposits_7d      bigint,
  deposits_28d     bigint,
  deposit_usd_7d   numeric
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from profiles
       where created_at >= now() - interval '7 days')                      as signups_7d,
    (select coalesce(avg(case when
               kys_completed_at is not null
               or tradingview_username is not null
               or exists (
                    select 1 from app_events ae
                     where ae.user_id = p.id and ae.event <> 'email_visit'
                  )
             then 1.0 else 0.0 end), 0)
       from profiles p
      where p.created_at >= now() - interval '30 days')                    as activation_rate,
    (select count(*) from profiles
       where account_status = 'trial_active')                              as trials_active,
    (select count(*) from profiles
       where deposit_verified_at >= now() - interval '7 days')             as deposits_7d,
    (select count(*) from profiles
       where deposit_verified_at >= now() - interval '28 days')            as deposits_28d,
    (select coalesce(sum(deposit_amount), 0) from profiles
       where deposit_verified_at >= now() - interval '7 days')             as deposit_usd_7d
$$;

revoke all on function public.fn_pillar_webapp() from public, anon, authenticated;
grant execute on function public.fn_pillar_webapp() to service_role;

comment on function public.fn_pillar_webapp() is
  'Command Center webapp pillar: signups, activation, live trials, deposits and deposit value. Column names are a contract with mmfx-brain src/command/pillars/webapp.ts. Service role only.';


-- ---------------------------------------------------------------------------
-- fn_pillar_email — sends, delivery, clicks, attributed signups.
--
-- Opens are deliberately absent: MPP-inflated, and a number that must not drive a decision
-- has no business being a KPI.
--
-- sent_7d is restricted to ok = true. email_sends.ok can be true, false OR NULL (a provider
-- failure, or a send still in flight — 122 null rows as of 2026-10-01); counting those as
-- sent would inflate the metric and depress delivery_rate for a reason unrelated to
-- deliverability.
--
-- delivered_7d / clicked_7d are windowed on the SEND's sent_at, not the event's occurred_at.
-- Windowing the numerator on event time let a send from 9 days ago, clicked today, be
-- credited to this week's population it was never part of. Measured 2026-10-01: harmless for
-- delivered (0 of ~19k, delivery follows sending within minutes) but real for clicked
-- (14 of 100), which was inflating click_rate by roughly 14 points.
--
-- attributed_signups_7d uses attr_last_cid, NOT attr_cid. attr_cid is first-touch and is
-- unpopulated in production (0 of 4,249 rows) because no signup has ever arrived carrying
-- the cookie; attr_last_cid carries the real EML-* values written by the touch path. Note
-- this differs from fn_pillar_seo below, which correctly uses first-touch — the two
-- channels work differently: an email recipient already had a profile before their send, so
-- a first-touch EML attribution is impossible by construction, whereas a guide reader signs
-- up fresh and first touch is exactly the right question.
-- ---------------------------------------------------------------------------
create or replace function public.fn_pillar_email()
returns table (
  sent_7d                bigint,
  delivered_7d           bigint,
  clicked_7d             bigint,
  attributed_signups_7d  bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from email_sends
       where sent_at >= now() - interval '7 days'
         and ok = true)                                                    as sent_7d,
    (select count(distinct es.id) from email_sends es
       join email_events e on e.send_id = es.id and e.event = 'delivered'
      where es.sent_at >= now() - interval '7 days'
        and es.ok = true)                                                  as delivered_7d,
    (select count(distinct es.id) from email_sends es
       join email_events e on e.send_id = es.id and e.event = 'clicked'
      where es.sent_at >= now() - interval '7 days'
        and es.ok = true)                                                  as clicked_7d,
    (select count(*) from profiles
       where created_at >= now() - interval '7 days'
         and attr_last_cid like 'EML-%')                                   as attributed_signups_7d
$$;

revoke all on function public.fn_pillar_email() from public, anon, authenticated;
grant execute on function public.fn_pillar_email() to service_role;

comment on function public.fn_pillar_email() is
  'Command Center email pillar: sends, delivery, clicks, attributed signups. No opens by design (MPP-inflated). Column names are a contract with mmfx-brain src/command/pillars/email.ts. Service role only.';


-- ---------------------------------------------------------------------------
-- fn_pillar_seo — signups attributed to a guide.
--
-- attr_cid, deliberately: FIRST touch, the same column organic_signups_by_cid filters on,
-- so the pillar and the weekly report can never disagree. attr_last_cid is any later touch
-- at any time, which would count a member who browsed a guide months after signing up as an
-- SEO-driven signup. For content the question is "what brought them".
--
-- Expect 0 until a guide signup lands: the SEO- cid emitter shipped 2026-10-01
-- (mmfx-marketing-site writes SEO-guide-<slug> into the mmfx_attr cookie on a guide view),
-- and the brain's reader raises a `warn` finding while this is 0 — one real signup clears it.
-- ---------------------------------------------------------------------------
create or replace function public.fn_pillar_seo()
returns table (organic_signups_7d bigint)
language sql
security definer
set search_path = public
as $$
  select count(*) as organic_signups_7d
    from profiles
   where created_at >= now() - interval '7 days'
     and attr_cid like 'SEO-%'
$$;

revoke all on function public.fn_pillar_seo() from public, anon, authenticated;
grant execute on function public.fn_pillar_seo() to service_role;

comment on function public.fn_pillar_seo() is
  'Command Center seo pillar: signups whose FIRST-touch cid is SEO-% (matches organic_signups_by_cid). Column name is a contract with mmfx-brain src/command/pillars/seo.ts. Service role only.';

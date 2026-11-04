-- ============================================================================
-- Lifecycle KPIs count English sends only (4 Nov 2026).
--   The challenger arms in email_variants are English copy. Since emails go out
--   in the member's language, a reader in another language always gets the
--   translated default and the send is filed as arm A
--   (src/app/api/cron/email-lifecycle/route.ts). Counted together, arm A would
--   hold two audiences against B's one and the brain could promote the wrong
--   copy. fn_email_kpis now reads English sends alone: email_sends.locale 'en',
--   or null for every send before 4 Nov.
-- Re-created from the live definition (pg_get_functiondef) with that one
-- filter added; the signature and grants are unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_email_kpis(p_since timestamp with time zone DEFAULT (now() - '28 days'::interval), p_until timestamp with time zone DEFAULT now())
 RETURNS TABLE(flow text, step text, variant text, sends integer, delivered integer, opened integer, clicked integer, visited integer, goal_done integer, unsubscribed integer, complaints integer, bounced integer, open_p50_min numeric, click_p50_min numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with s as (
    select es.id, es.user_id, es.flow, es.step, es.variant, es.sent_at
      from public.email_sends es
     where es.sent_at >= p_since
       and es.sent_at <  p_until
       and es.ok is true
       -- English sends only: see the header of 20261104000005.
       and coalesce(es.locale, 'en') = 'en'
  ),
  ev as (
    -- One row per (send, event): the FIRST time it happened.
    select e.send_id, e.event, min(e.occurred_at) as first_at
      from public.email_events e
     where e.send_id is not null
     group by e.send_id, e.event
  ),
  agg as (
    select s.id,
           bool_or(ev.event = 'delivered')                              as delivered,
           bool_or(ev.event = 'opened')                                 as opened,
           bool_or(ev.event = 'clicked')                                as clicked,
           bool_or(ev.event in ('unsubscribed'))                        as unsubscribed,
           bool_or(ev.event = 'spam')                                   as complaint,
           bool_or(ev.event in ('hard_bounce', 'soft_bounce', 'undelivered')) as bounced,
           min(ev.first_at) filter (where ev.event = 'opened')          as opened_at,
           min(ev.first_at) filter (where ev.event = 'clicked')         as clicked_at
      from s
      left join ev on ev.send_id = s.id
     group by s.id
  ),
  vis as (
    select s.id,
           exists (
             select 1
               from public.app_events a
              where a.user_id = s.user_id
                and a.event = 'email_visit'
                and a.props ->> 'cid' = 'EML-' || s.flow || '-' || s.step
                and a.created_at >= s.sent_at
                and a.created_at <= s.sent_at + interval '72 hours'
           ) as visited
      from s
  ),
  per as (
    select s.flow,
           s.step,
           s.variant,
           s.sent_at,
           coalesce(a.delivered, false)    as delivered,
           coalesce(a.opened, false)       as opened,
           coalesce(a.clicked, false)      as clicked,
           coalesce(a.unsubscribed, false) as unsubscribed,
           coalesce(a.complaint, false)    as complaint,
           coalesce(a.bounced, false)      as bounced,
           a.opened_at,
           a.clicked_at,
           v.visited,
           case
             -- The read itself is the goal for the three analysis-shaped steps.
             when s.flow || '/' || s.step in ('trial/welcome', 'trial/analysis', 'nurture/digest') then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'feature_view'
                          and a2.props ->> 'feature' = 'daily-analysis'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- Know Your Style is a profile column, not an event.
             when s.step = 'kys' then
               exists (select 1 from public.profiles p
                        where p.id = s.user_id
                          and p.kys_completed_at > s.sent_at
                          and p.kys_completed_at <= s.sent_at + interval '72 hours')
             when s.step = 'tv' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'tv_username_set'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             when s.step = 'lesson1' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'onboarding_step_done'
                          and a2.props ->> 'step' = 'lesson-1'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- The ladder steps: seeing the upgrade page is the goal;
             -- deposit_submitted is the secondary the brain reads separately.
             when s.step in ('ladder', 'day12', 'upgrade-seen') then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'upgrade_viewed'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             when s.step = 'broker-clicked' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'deposit_submitted'
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- A guide read only counts if they actually landed on it.
             when s.step = 'spotlight' then
               coalesce(a.clicked, false) and v.visited
             -- member-d3's goal is a RUNNING assistant, connected after the email.
             when s.step = 'member-d3' then
               exists (select 1 from public.journal_accounts ja
                        where ja.user_id = s.user_id
                          and ja.state = 'deployed'
                          and ja.created_at >= s.sent_at
                          and ja.created_at <= s.sent_at + interval '72 hours')
             when s.step = 'member-d7' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.event = 'feature_view'
                          and a2.props ->> 'feature' in ('live-classes', 'fundamental-desk')
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             -- Dormancy's goal is simply coming back at all.
             when s.step = 'member-dormant' then
               exists (select 1 from public.app_events a2
                        where a2.user_id = s.user_id
                          and a2.created_at >= s.sent_at
                          and a2.created_at <= s.sent_at + interval '72 hours')
             else false
           end as goal_done
      from s
      join agg a on a.id = s.id
      join vis v on v.id = s.id
  )
  select p.flow,
         p.step,
         p.variant,
         count(*)::int                                       as sends,
         count(*) filter (where p.delivered)::int            as delivered,
         count(*) filter (where p.opened)::int               as opened,
         count(*) filter (where p.clicked)::int              as clicked,
         count(*) filter (where p.visited)::int              as visited,
         count(*) filter (where p.goal_done)::int            as goal_done,
         count(*) filter (where p.unsubscribed)::int         as unsubscribed,
         count(*) filter (where p.complaint)::int            as complaints,
         count(*) filter (where p.bounced)::int              as bounced,
         round(
           percentile_cont(0.5) within group (
             order by extract(epoch from (p.opened_at - p.sent_at)) / 60
           )::numeric, 1)                                    as open_p50_min,
         round(
           percentile_cont(0.5) within group (
             order by extract(epoch from (p.clicked_at - p.sent_at)) / 60
           )::numeric, 1)                                    as click_p50_min
    from per p
   group by p.flow, p.step, p.variant
   order by p.flow, p.step, p.variant;
$function$;

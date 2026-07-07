-- ============================================================================
-- AI Trading Journal — reports are on-demand only (no automatic daily cron).
-- Track how many times a user generated a report on a given day so the
-- generate route can enforce a per-user daily cap.
-- ============================================================================

alter table public.journal_reports
  add column if not exists gen_count integer not null default 0;

comment on column public.journal_reports.gen_count is
  'Times the user generated a report for this report_date. Capped in /api/journal/report/generate.';

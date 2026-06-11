-- ============================================================================
-- Daily Analysis v2 — richer fields to match the real content model:
-- session tag, publish flag, a public cover image, and a GATED PDF report.
--
--   - cover image  -> public bucket `analysis-covers` (page is gated anyway;
--                     the cover is just card art, served by public URL)
--   - PDF report   -> private bucket `analysis-reports`, Full-read via
--                     is_full_access(), admin-write via is_admin() — same
--                     posture as ebooks/slides, plus admin upload.
-- Buckets are created here in SQL (no manual dashboard step).
-- ============================================================================

alter table public.daily_analysis
  add column session_tag  text,
  add column is_published boolean not null default true,
  add column cover_path   text,
  add column report_path  text;

-- ----------------------------------------------------------------------------
-- Buckets
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('analysis-covers',  'analysis-covers',  true),
  ('analysis-reports', 'analysis-reports', false)
on conflict (id) do update set public = excluded.public;

-- ----------------------------------------------------------------------------
-- analysis-reports (private): Full-read, admin-write.
-- ----------------------------------------------------------------------------
drop policy if exists "analysis_reports_full_read" on storage.objects;
create policy "analysis_reports_full_read"
  on storage.objects
  for select
  to authenticated
  using ( bucket_id = 'analysis-reports' and public.is_full_access() );

drop policy if exists "analysis_reports_admin_write" on storage.objects;
create policy "analysis_reports_admin_write"
  on storage.objects
  for all
  to authenticated
  using ( bucket_id = 'analysis-reports' and public.is_admin() )
  with check ( bucket_id = 'analysis-reports' and public.is_admin() );

-- ----------------------------------------------------------------------------
-- analysis-covers (public read via public URL): admin-write only.
-- ----------------------------------------------------------------------------
drop policy if exists "analysis_covers_admin_write" on storage.objects;
create policy "analysis_covers_admin_write"
  on storage.objects
  for all
  to authenticated
  using ( bucket_id = 'analysis-covers' and public.is_admin() )
  with check ( bucket_id = 'analysis-covers' and public.is_admin() );

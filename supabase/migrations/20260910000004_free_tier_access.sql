-- ============================================================================
-- Conversion-fix 2.3 — open the Free surfaces in the database.
--
-- The app now lets a Free user (an expired trial; the reverse trial) into
-- Daily Analysis and Module 1 of the course. Storage and table RLS were a
-- second, Full-only gate on the same content, so without these policies those
-- pages would render empty and the downloads would 404.
--
-- Additive only: every existing *_full policy stays exactly as it is. RLS
-- policies OR together, so these widen access for signed-in users and nothing
-- else. Still Full-only: live_classes, eBooks, and slides outside Module 1.
-- ============================================================================


-- Daily Analysis is free for every signed-in user (decision 3): published rows
-- only. Drafts stay visible to Full users via daily_analysis_select_full, as
-- they are today.
drop policy if exists "daily_analysis_select_signed_in" on public.daily_analysis;
create policy "daily_analysis_select_signed_in"
  on public.daily_analysis
  for select
  to authenticated
  using ( is_published );


-- The Daily Analysis PDF. Only objects that ARE the report of a published
-- entry, so an unpublished draft's PDF can't be pulled by guessing its path.
-- The subquery runs as the caller, whose read of daily_analysis is itself
-- limited to published rows by the policy above.
drop policy if exists "analysis_reports_signed_in_read" on storage.objects;
create policy "analysis_reports_signed_in_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'analysis-reports'
    and exists (
      select 1
      from public.daily_analysis d
      where d.report_path = objects.name
        and d.is_published
    )
  );


-- Module 1 ("Foundations", lessons 0–2) slide decks. The file names MUST match
-- the pptFile of Module 1's lessons in src/app/course/courseData.ts; a vitest
-- (src/lib/access/course.test.ts) fails if they drift apart.
drop policy if exists "slides_module1_signed_in_read" on storage.objects;
create policy "slides_module1_signed_in_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'slides'
    and name in (
      'basic_v1_gold_mindset.pptx',
      'basic_v2_xauusd_explained.pptx',
      'basic_v3_what_moves_gold.pptx'
    )
  );

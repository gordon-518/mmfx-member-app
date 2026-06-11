-- ============================================================================
-- Day 8 · Task 1 — tier-gate the private `slides` bucket (course PPT decks).
--
-- Same pattern as the Day-7 ebooks gate: a storage RLS SELECT policy that
-- only lets Full-tier authenticated users read objects in the `slides`
-- bucket. Reuses the EXISTING public.is_full_access() (defined Day 7) — not
-- redefined here.
--
-- The bucket must be PRIVATE — a public bucket bypasses RLS entirely (the
-- Day-7 lesson). No INSERT/UPDATE/DELETE policy: PPTs are uploaded by Gordon
-- via the dashboard, never by app users. anon gets nothing.
-- ============================================================================

drop policy if exists "slides_full_access_read" on storage.objects;

create policy "slides_full_access_read"
  on storage.objects
  for select
  to authenticated
  using ( bucket_id = 'slides' and public.is_full_access() );

-- ============================================================================
-- The ebooks bucket was created as `eBooks` (case-sensitive), not `ebooks`.
-- Repoint the tier-gating storage policy at the actual bucket id so a Limited
-- user is denied and a Full user is allowed at the storage layer.
--
-- (The app code uses EBOOKS_BUCKET = 'eBooks' to match. The bucket must also
-- be PRIVATE — a public bucket bypasses RLS entirely; that toggle is done in
-- the Storage dashboard, not in SQL.)
-- ============================================================================

drop policy if exists "ebooks_full_access_read" on storage.objects;

create policy "ebooks_full_access_read"
  on storage.objects
  for select
  to authenticated
  using ( bucket_id = 'eBooks' and public.is_full_access() );

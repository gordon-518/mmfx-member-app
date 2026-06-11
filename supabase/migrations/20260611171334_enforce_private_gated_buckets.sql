-- ============================================================================
-- Defense-in-depth: keep the gated content buckets PRIVATE in SQL.
--
-- A public bucket bypasses storage RLS entirely (the Day-7 lesson). The
-- private flag was set manually in the dashboard; this makes it self-healing
-- so an accidental toggle or a restore can't silently defeat the gate. UPDATE
-- on storage.buckets is permitted for the migration role (verified). No-op
-- when the buckets are already private.
-- ============================================================================

update storage.buckets
set public = false
where id in ('eBooks', 'slides');

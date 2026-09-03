-- ============================================================================
-- organic-assets — rendered social images. PUBLIC on purpose: Ayrshare must fetch
-- media over plain HTTPS with no auth, so a private bucket cannot work here.
-- Nothing gated ever goes in this bucket; it holds only artwork already destined
-- for public social feeds.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('organic-assets', 'organic-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "organic_assets_admin_write" on storage.objects;
create policy "organic_assets_admin_write"
  on storage.objects
  for insert
  to authenticated
  with check ( bucket_id = 'organic-assets' and public.is_admin() );

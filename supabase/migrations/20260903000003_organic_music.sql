-- ============================================================================
-- organic-music — sync-licensed audio for short-form video. PRIVATE, unlike
-- organic-assets: nothing fetches these over plain HTTPS. The video assembler
-- downloads with the service role and mixes the track into the file locally.
-- Keeping it private also keeps MMFX's licensed library from being hotlinked.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('organic-music', 'organic-music', false)
on conflict (id) do update set public = excluded.public;

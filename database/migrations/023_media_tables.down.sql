-- ==========================================================================
-- Migration 023 · ROLLBACK
-- ==========================================================================

drop function if exists public.mark_image_as_primary(uuid);

drop policy if exists "write_documents_authenticated" on public.resource_documents;
drop policy if exists "read_documents_via_resource"   on public.resource_documents;
drop policy if exists "write_videos_authenticated"    on public.resource_videos;
drop policy if exists "read_videos_via_resource"      on public.resource_videos;
drop policy if exists "write_images_authenticated"    on public.resource_images;
drop policy if exists "read_images_via_resource"      on public.resource_images;

drop table if exists public.resource_documents;
drop table if exists public.resource_videos;
drop table if exists public.resource_images;

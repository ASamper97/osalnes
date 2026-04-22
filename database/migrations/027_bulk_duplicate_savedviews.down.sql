-- ==========================================================================
-- Migration 027 · ROLLBACK
-- ==========================================================================

drop function if exists public.bulk_delete_resources(uuid[]);
drop function if exists public.bulk_change_status(uuid[], text);
drop function if exists public.delete_saved_view(uuid);
drop function if exists public.upsert_saved_view(text, jsonb, text, text, integer, boolean);
drop function if exists public.list_saved_views();

drop policy if exists saved_views_owner_rw on public.saved_views;
drop index if exists idx_saved_views_owner;
drop index if exists idx_saved_views_one_default_per_user;
drop table if exists public.saved_views;

drop function if exists public.duplicate_resource(uuid);

-- ==========================================================================
-- Migration 028 · ROLLBACK
-- ==========================================================================

drop function if exists public.dashboard_get_une_indicators();
drop function if exists public.band_from_percent(numeric);
drop function if exists public.dashboard_get_translation_progress();
drop function if exists public.dashboard_get_recent_activity(integer, boolean);
drop function if exists public.dashboard_get_upcoming_scheduled(integer);
drop function if exists public.dashboard_get_my_work(integer);
drop function if exists public.dashboard_get_overview();

drop policy if exists export_jobs_read on public.export_jobs;
drop index if exists idx_export_jobs_type_status;
drop index if exists idx_export_jobs_started;
drop table if exists public.export_jobs;

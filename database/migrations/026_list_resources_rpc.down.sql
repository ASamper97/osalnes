-- ==========================================================================
-- Migration 026 · ROLLBACK
-- ==========================================================================

drop function if exists public.change_resource_status(uuid, text);
drop function if exists public.list_resources_kpis(uuid);
drop function if exists public.list_resources(
  text, text, text[], uuid[], text[], boolean, boolean, boolean, uuid,
  text, text, integer, integer
);
drop view if exists public.resources_list_view;
drop function if exists public.count_pid_missing_required(public.resources);
drop function if exists public.compute_resource_quality_score(public.resources);

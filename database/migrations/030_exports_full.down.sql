-- ==========================================================================
-- Migration 030 · ROLLBACK (Fase A)
-- ==========================================================================

drop function if exists public.exports_get_kpis();
drop function if exists public.exports_list(text, text, timestamptz, timestamptz, boolean, integer, integer);
drop function if exists public.exports_process_pending(uuid);
drop function if exists public.exports_launch(text, text, jsonb, uuid[], text);
drop function if exists public.exports_validate_scope(text, jsonb, uuid[], text);
drop function if exists public.exports_resolve_scope_ids(text, jsonb, uuid[]);

drop policy if exists export_job_records_read on public.export_job_records;
drop index if exists idx_export_job_records_resource;
drop index if exists idx_export_job_records_status;
drop index if exists idx_export_job_records_job;
drop table if exists public.export_job_records;

drop index if exists idx_export_jobs_status_type;
drop index if exists idx_export_jobs_retry_of;

alter table public.export_jobs
  drop column if exists notes,
  drop column if exists records_skipped,
  drop column if exists records_failed,
  drop column if exists duration_ms,
  drop column if exists retry_of,
  drop column if exists validation_errors,
  drop column if exists scope_ids,
  drop column if exists scope_filter,
  drop column if exists scope_type,
  drop column if exists response_payload,
  drop column if exists payload;

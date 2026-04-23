-- ==========================================================================
-- Migration 031 · ROLLBACK
-- ==========================================================================

drop function if exists public.exports_retry(uuid, text);
drop function if exists public.exports_get_log_text(uuid, boolean);
drop function if exists public.exports_get_payload_bundle(uuid);
drop function if exists public.exports_get_record_payload(uuid);
drop function if exists public.exports_get_records(uuid, text, integer, integer);
drop function if exists public.exports_get_detail(uuid);

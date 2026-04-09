-- =============================================================================
-- Migration 012 — GDPR retention function for log_cambios
-- =============================================================================
--
-- WHY
-- ---
-- log_cambios stores `usuario_id` for every mutation (so we know WHO did
-- WHAT). usuario_id is personal data under GDPR (Reglamento UE 2016/679).
-- GDPR Art. 5(1)(e) — "storage limitation" — requires that personal data is
-- kept "no longer than is necessary for the purposes for which the personal
-- data are processed". Audit logs have a legitimate purpose (UNE 178502
-- §6.4 trazabilidad, ENS [op.exp.8] registro de actividad), but they should
-- not retain the actor identifier indefinitely.
--
-- We follow the standard public-sector practice: KEEP the audit record
-- (action, entity, timestamp, diff) but ANONYMIZE the actor after a
-- retention window. The default is 730 days (2 years), aligned with the
-- ENS recommendation for category MEDIA systems.
--
-- This migration only DEFINES the function. It does NOT schedule it. The
-- ops team should run it on a regular schedule via:
--   * Supabase Cron (pg_cron) — preferred
--   * External scheduler (GitHub Actions, Vercel Cron, etc.) calling
--     `SELECT anonymize_audit_logs_older_than(730);`
--   * Manually each quarter
--
-- ROLLBACK
-- --------
-- See 012_audit_log_retention.down.sql

CREATE OR REPLACE FUNCTION anonymize_audit_logs_older_than(retention_days INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF retention_days < 30 THEN
    RAISE EXCEPTION 'retention_days must be >= 30 (got %). Refusing to anonymize recent audit data.', retention_days;
  END IF;

  UPDATE log_cambios
  SET    usuario_id = NULL
  WHERE  usuario_id IS NOT NULL
    AND  created_at < (NOW() - (retention_days || ' days')::INTERVAL);

  GET DIAGNOSTICS affected = ROW_COUNT;

  -- Leave a self-audit row so the anonymization itself is traceable.
  -- entidad_id is intentionally a synthetic UUID (the function call),
  -- and the "cambios" field documents the policy applied.
  INSERT INTO log_cambios (entidad_tipo, entidad_id, accion, usuario_id, cambios)
  VALUES (
    'log_cambios',
    gen_random_uuid(),
    'anonimizar',
    NULL,
    jsonb_build_object(
      'retention_days', retention_days,
      'rows_affected', affected,
      'gdpr_basis', 'Art. 5(1)(e) storage limitation'
    )
  );

  RETURN affected;
END;
$$;

COMMENT ON FUNCTION anonymize_audit_logs_older_than(INTEGER) IS
  'GDPR storage limitation helper: nullify usuario_id in log_cambios rows '
  'older than the given number of days. Default retention is 730 (2 years). '
  'Returns the number of rows affected. Refuses retention < 30 days.';

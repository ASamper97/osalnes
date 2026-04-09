-- =============================================================================
-- Migration 013 — Allow 'anonimizar' as a log_cambios.accion value
-- =============================================================================
--
-- WHY
-- ---
-- Migration 012 added the GDPR retention helper
-- `anonymize_audit_logs_older_than(days)` which inserts a self-audit row
-- with `accion = 'anonimizar'` so the act of anonymization is itself
-- traceable. The original 001_initial_schema.sql declared a CHECK
-- constraint on log_cambios.accion that only allowed
--   ('crear', 'modificar', 'eliminar', 'publicar', 'archivar')
-- so the very first call to anonymize_audit_logs_older_than() failed with
-- SQLSTATE 23514 (check_violation).
--
-- This migration extends the constraint to also accept 'anonimizar'. It is
-- intentionally a separate file from 012 because 012 is already applied in
-- production — re-running it would be a no-op for the function but would
-- not retro-fix the schema. Migrations are immutable once applied.
--
-- ROLLBACK
-- --------
-- See 013_extend_log_accion_constraint.down.sql

ALTER TABLE log_cambios
  DROP CONSTRAINT IF EXISTS log_cambios_accion_check;

ALTER TABLE log_cambios
  ADD CONSTRAINT log_cambios_accion_check
  CHECK (accion IN (
    'crear',
    'modificar',
    'eliminar',
    'publicar',
    'archivar',
    'anonimizar'  -- new in 013, used by anonymize_audit_logs_older_than()
  ));

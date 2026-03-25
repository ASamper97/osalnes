-- =============================================================================
-- Migracion 005: Alinear columnas de export_job con el codigo
-- Renombra columnas para consistencia con el resto del proyecto
-- =============================================================================

ALTER TABLE export_job RENAME COLUMN registros_error TO registros_err;
ALTER TABLE export_job RENAME COLUMN finalizado_at TO completed_at;
ALTER TABLE export_job RENAME COLUMN iniciado_at TO started_at;

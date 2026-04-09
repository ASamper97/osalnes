-- Rollback for migration 013 — restore the original CHECK constraint.
--
-- WARNING: this rollback will FAIL if any log_cambios row already has
-- `accion = 'anonimizar'`. To force, first delete or update those rows.

ALTER TABLE log_cambios
  DROP CONSTRAINT IF EXISTS log_cambios_accion_check;

ALTER TABLE log_cambios
  ADD CONSTRAINT log_cambios_accion_check
  CHECK (accion IN ('crear', 'modificar', 'eliminar', 'publicar', 'archivar'));

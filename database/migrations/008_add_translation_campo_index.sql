-- =============================================================================
-- Migration 008: Add index on traduccion.campo for faster field lookups
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_traduccion_campo
  ON traduccion (entidad_tipo, campo);

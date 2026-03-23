-- =============================================================================
-- ADD: storage_path to documento_descargable (para poder borrar del Storage)
-- =============================================================================

ALTER TABLE documento_descargable
ADD COLUMN IF NOT EXISTS storage_path VARCHAR(1000);

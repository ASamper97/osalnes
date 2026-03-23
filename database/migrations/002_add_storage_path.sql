-- =============================================================================
-- Migracion 002: Añadir storage_path a asset_multimedia
-- Para poder eliminar ficheros de Supabase Storage
-- =============================================================================

ALTER TABLE asset_multimedia ADD COLUMN IF NOT EXISTS storage_path VARCHAR(1000);

-- Rollback for migration 010 — disable RLS on every table.
-- Restores the previous (insecure) state. Only use if RLS is causing
-- production breakage and you need to revert quickly while you debug.

ALTER TABLE usuario              DISABLE ROW LEVEL SECURITY;
ALTER TABLE municipio            DISABLE ROW LEVEL SECURITY;
ALTER TABLE zona                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE tipologia            DISABLE ROW LEVEL SECURITY;
ALTER TABLE categoria            DISABLE ROW LEVEL SECURITY;
ALTER TABLE producto_turistico   DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurso_turistico    DISABLE ROW LEVEL SECURITY;
ALTER TABLE relacion_recurso     DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurso_categoria    DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurso_producto     DISABLE ROW LEVEL SECURITY;
ALTER TABLE traduccion           DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_multimedia     DISABLE ROW LEVEL SECURITY;
ALTER TABLE documento_descargable DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagina               DISABLE ROW LEVEL SECURITY;
ALTER TABLE navegacion           DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_cambios          DISABLE ROW LEVEL SECURITY;
ALTER TABLE export_job           DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assistant_log') THEN
    EXECUTE 'ALTER TABLE assistant_log DISABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'translation_job') THEN
    EXECUTE 'ALTER TABLE translation_job DISABLE ROW LEVEL SECURITY';
  END IF;
END $$;

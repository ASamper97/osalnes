-- =============================================================================
-- Migration 010 — Enable Row Level Security baseline
-- =============================================================================
--
-- WHY
-- ---
-- The CMS frontend (`packages/cms/src/lib/supabase.ts`) and the public web
-- (`packages/web/src/lib/supabase.ts`) both ship the Supabase **anon key**
-- in their bundled JavaScript. The anon key is intentionally public, but it
-- is only safe when Row Level Security is ENABLED on every table that
-- contains data. Until this migration runs, RLS is OFF on every table in
-- the schema, which means the default Postgres GRANTs apply. In Supabase
-- those grants give the `anon` role full SELECT on every table in the
-- `public` schema by default.
--
-- HOW WE CONFIRMED IT IS SAFE TO LOCK ALL TABLES
-- ----------------------------------------------
-- Audited every file in the monorepo for direct table reads via the
-- supabase-js client (`supabase.from('xxx').select(...)`). Result:
--   * packages/cms/src     — 0 matches (uses Edge Function via api.ts)
--   * packages/web/src     — 0 matches (uses Edge Function via api-client.ts)
-- Both Edge Functions (`supabase/functions/admin/index.ts` and
-- `supabase/functions/api/index.ts`) call `getAdminClient()` which uses the
-- SERVICE ROLE key. Service role bypasses RLS, so this migration is purely
-- defense-in-depth: it does NOT change any current code path, but it does
-- close the gap that would let anyone with the anon key (i.e. anyone who
-- inspects the JS bundle) read every row in every table via PostgREST.
--
-- DESIGN
-- ------
-- We enable RLS on every table and create NO policies. With RLS on and no
-- policies, the default is "deny everything" for non-service-role roles.
-- The Edge Functions keep working because they use service_role.
--
-- If a future feature needs anon read access (e.g. exposing published
-- resources directly to a static site generator), add an explicit policy:
--
--   CREATE POLICY recurso_public_read ON recurso_turistico
--     FOR SELECT TO anon
--     USING (estado_editorial = 'publicado');
--
-- ROLLBACK
-- --------
-- See 010_enable_rls_baseline.down.sql

ALTER TABLE usuario              ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipio            ENABLE ROW LEVEL SECURITY;
ALTER TABLE zona                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipologia            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_turistico   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurso_turistico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE relacion_recurso     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurso_categoria    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurso_producto     ENABLE ROW LEVEL SECURITY;
ALTER TABLE traduccion           ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_multimedia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_descargable ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagina               ENABLE ROW LEVEL SECURITY;
ALTER TABLE navegacion           ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_cambios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_job           ENABLE ROW LEVEL SECURITY;

-- Tables added in later migrations (006, 007). Wrap in DO block so the
-- migration is idempotent if a table happens to be missing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assistant_log') THEN
    EXECUTE 'ALTER TABLE assistant_log ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'translation_job') THEN
    EXECUTE 'ALTER TABLE translation_job ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

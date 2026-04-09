-- =============================================================================
-- Migration 014 — zona table hardening
-- =============================================================================
--
-- Resolves four findings from the Zonas audit (section 6, A1-A4):
--
--   A1. zona had no updated_at, created_by, updated_by — every other content
--       table (recurso_turistico, pagina, usuario...) tracks them. We add the
--       three columns plus an updated_at trigger using the existing
--       trigger_set_updated_at() function.
--
--   A2. zona.slug was UNIQUE globally. That meant you could not have a
--       "centro-historico" zone in Vilanova AND another in Cambados — the
--       second one would fail with a duplicate-key violation. Slugs should
--       be unique PER MUNICIPIO so each concello can use the same set of
--       parish names. We drop the global unique and create a composite
--       (slug, municipio_id) unique index.
--
--   A3. There was no index on zona.municipio_id, so the most common query
--       (`WHERE municipio_id = X`, used by every resource form and the
--       zones map page) was doing a sequential scan. The composite unique
--       index from A2 covers (slug, municipio_id), but Postgres can only
--       use it for queries that filter on the LEFTMOST column (slug), so
--       we still need a dedicated single-column index on municipio_id.
--
--   A4. zona.municipio_id was nullable. A zone with no municipio is
--       semantically meaningless and breaks the cascade UI in the resource
--       wizard. We SET NOT NULL after a guard that aborts the migration if
--       any orphan row exists (so the operator knows to clean up first).
--
-- ROLLBACK
-- --------
-- See 014_zona_schema_hardening.down.sql

-- ─── A4 guard ──────────────────────────────────────────────────────────────
-- Abort early if any zona has NULL municipio_id, so the operator can clean
-- up by hand instead of getting a cryptic error halfway through the
-- migration.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM zona WHERE municipio_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration 014 aborted: % zona row(s) have NULL municipio_id. Reassign or delete them first, then re-run.', orphan_count;
  END IF;
END $$;

-- ─── A1: created_by / updated_by / updated_at ─────────────────────────────
ALTER TABLE zona
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES usuario(id) ON DELETE SET NULL;

-- Backfill updated_at from created_at so legacy rows have a sane value.
UPDATE zona SET updated_at = created_at WHERE updated_at IS NULL;

-- Reuse the existing trigger function defined in 001_initial_schema.sql.
DROP TRIGGER IF EXISTS set_updated_at_zona ON zona;
CREATE TRIGGER set_updated_at_zona
  BEFORE UPDATE ON zona
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── A2: slug unique per municipio (not globally) ─────────────────────────
-- The original 001_initial_schema.sql declared `slug VARCHAR(200) UNIQUE`,
-- which Postgres implements as an implicit constraint named zona_slug_key.
ALTER TABLE zona DROP CONSTRAINT IF EXISTS zona_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS zona_slug_municipio_uniq
  ON zona (municipio_id, slug);

-- ─── A3: index on municipio_id for the cascade query ──────────────────────
CREATE INDEX IF NOT EXISTS idx_zona_municipio
  ON zona (municipio_id);

-- ─── A4: enforce NOT NULL on municipio_id ─────────────────────────────────
ALTER TABLE zona
  ALTER COLUMN municipio_id SET NOT NULL;

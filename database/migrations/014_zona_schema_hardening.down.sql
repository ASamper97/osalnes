-- Rollback for migration 014 — restore original (weaker) zona schema.
--
-- WARNING: rolling back A2 will FAIL if any two zonas share the same slug
-- after the per-municipio uniqueness was relaxed (impossible to satisfy
-- the original global UNIQUE). To force, dedupe slugs first.

ALTER TABLE zona ALTER COLUMN municipio_id DROP NOT NULL;

DROP INDEX IF EXISTS idx_zona_municipio;
DROP INDEX IF EXISTS zona_slug_municipio_uniq;

ALTER TABLE zona ADD CONSTRAINT zona_slug_key UNIQUE (slug);

DROP TRIGGER IF EXISTS set_updated_at_zona ON zona;

ALTER TABLE zona
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;

-- =============================================================================
-- Migration 015 — Atomic create/update zona RPCs
-- =============================================================================
--
-- WHY (audit finding A6)
-- ----------------------
-- The Edge Function admin/zones handler currently does:
--
--   1. INSERT INTO zona (slug, municipio_id) RETURNING id
--   2. UPSERT INTO traduccion (...) for each language
--
-- These are two separate calls from the Edge Function. If the second one
-- fails (network blip, rate limit, validation error...), step 1 has already
-- committed and you get a "zombie zone" with no name. The user sees the
-- zone in the list with a blank label and cannot easily diagnose what
-- happened.
--
-- PL/pgSQL functions are atomic by default — every statement inside a
-- function body runs in the same transaction, and any RAISE rolls everything
-- back. Moving the multi-statement logic into a Postgres function makes the
-- whole zone+translations operation atomic from the Edge Function's point
-- of view.
--
-- The functions also accept created_by / updated_by so the audit columns
-- added in migration 014 (A1) get populated automatically.
--
-- ROLLBACK
-- --------
-- See 015_zona_atomic_rpcs.down.sql

-- ─── create_zona ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_zona(
  p_slug         TEXT,
  p_municipio_id UUID,
  p_name         JSONB,         -- e.g. '{"es":"Centro","gl":"Centro","en":""}'
  p_created_by   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
  lang   TEXT;
  val    TEXT;
BEGIN
  -- Insert the zone row first so we have its id for the translations.
  INSERT INTO zona (slug, municipio_id, created_by, updated_by)
  VALUES (p_slug, p_municipio_id, p_created_by, p_created_by)
  RETURNING id INTO new_id;

  -- Insert each non-empty translation. Empty values are skipped (matching
  -- the front-end semantics — empty strings mean "no translation").
  FOR lang, val IN SELECT * FROM jsonb_each_text(COALESCE(p_name, '{}'::jsonb))
  LOOP
    IF val IS NOT NULL AND length(trim(val)) > 0 THEN
      INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
      VALUES ('zona', new_id, 'name', lang, val)
      ON CONFLICT (entidad_tipo, entidad_id, campo, idioma)
      DO UPDATE SET valor = EXCLUDED.valor;
    END IF;
  END LOOP;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION create_zona(TEXT, UUID, JSONB, UUID) IS
  'Atomic creation of a zona with multilingual name. Used by the admin '
  'Edge Function to avoid leaving "zombie" zonas if the translation insert '
  'fails after the zona insert (audit finding A6).';

-- ─── update_zona ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_zona(
  p_id           UUID,
  p_slug         TEXT,          -- nullable: skip if NULL
  p_municipio_id UUID,          -- nullable: skip if NULL
  p_name         JSONB,         -- nullable: skip if NULL
  p_updated_by   UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lang TEXT;
  val  TEXT;
BEGIN
  -- Update only the columns that were provided
  IF p_slug IS NOT NULL OR p_municipio_id IS NOT NULL OR p_updated_by IS NOT NULL THEN
    UPDATE zona
    SET    slug         = COALESCE(p_slug, slug),
           municipio_id = COALESCE(p_municipio_id, municipio_id),
           updated_by   = COALESCE(p_updated_by, updated_by)
           -- updated_at is set automatically by trigger_set_updated_at()
    WHERE  id = p_id;
  END IF;

  -- If the caller provided a name JSON, sync the translations:
  --   * non-empty entries upsert
  --   * empty entries delete (so a blanked field clears the row, matching
  --     the saveTranslations semantics fixed in Tanda 3 C6)
  IF p_name IS NOT NULL THEN
    FOR lang, val IN SELECT * FROM jsonb_each_text(p_name)
    LOOP
      IF val IS NULL OR length(trim(val)) = 0 THEN
        DELETE FROM traduccion
        WHERE  entidad_tipo = 'zona'
          AND  entidad_id = p_id
          AND  campo = 'name'
          AND  idioma = lang;
      ELSE
        INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
        VALUES ('zona', p_id, 'name', lang, val)
        ON CONFLICT (entidad_tipo, entidad_id, campo, idioma)
        DO UPDATE SET valor = EXCLUDED.valor;
      END IF;
    END LOOP;
  END IF;
END;
$$;

COMMENT ON FUNCTION update_zona(UUID, TEXT, UUID, JSONB, UUID) IS
  'Atomic update of a zona with multilingual name. Updates only the '
  'columns whose parameter is non-NULL, and syncs translations: empty '
  'values delete the row, non-empty values upsert.';

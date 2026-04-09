-- =============================================================================
-- Migration 016 — Optimistic concurrency control for zona updates (DF3)
-- =============================================================================
--
-- WHY
-- ---
-- Two admins can simultaneously open the same zona for editing. The current
-- update_zona() RPC simply UPDATEs the row, so whoever clicks "Save" last
-- silently overwrites the other admin's changes — no warning, no diff, no
-- way to reconcile. UNE 178502 §6.4 trazabilidad and basic data integrity
-- both expect this to be detected.
--
-- Migration 014 added the `updated_at` column with an automatic trigger.
-- This migration adds an OPTIONAL `p_expected_updated_at` parameter to
-- update_zona(). The Edge Function passes the value the client originally
-- loaded; if the row was modified in the meantime, the UPDATE matches 0
-- rows and we raise SQLSTATE 40001 (serialization_failure). The shared
-- error handler in supabase/functions/_shared/errors.ts already maps this
-- to a friendly Spanish message ("Conflicto de concurrencia. Reintenta en
-- unos segundos.") and HTTP 409 Conflict.
--
-- The parameter is OPTIONAL (defaults to NULL) so legacy clients that
-- don't send it still work — they just don't get the protection. The new
-- frontend always sends it.
--
-- We also restructure update_zona so it ALWAYS touches the zona row
-- (even if only translations changed), guaranteeing that:
--   1. The trigger fires and updated_at advances on every edit
--   2. The optimistic check has a meaningful ROW_COUNT to look at
--
-- ROLLBACK
-- --------
-- See 016_zona_optimistic_concurrency.down.sql

CREATE OR REPLACE FUNCTION update_zona(
  p_id                   UUID,
  p_slug                 TEXT,          -- nullable: skip if NULL
  p_municipio_id         UUID,          -- nullable: skip if NULL
  p_name                 JSONB,         -- nullable: skip if NULL
  p_updated_by           UUID DEFAULT NULL,
  p_expected_updated_at  TIMESTAMPTZ DEFAULT NULL  -- DF3: optimistic concurrency
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lang          TEXT;
  val           TEXT;
  rows_affected INTEGER;
BEGIN
  -- Always touch the zona row so:
  --   1. updated_at advances via the trigger (consistent audit trail)
  --   2. ROW_COUNT is reliable for the optimistic-concurrency check below
  --
  -- COALESCE keeps existing values when the caller passed NULL.
  UPDATE zona
  SET    slug         = COALESCE(p_slug, slug),
         municipio_id = COALESCE(p_municipio_id, municipio_id),
         updated_by   = COALESCE(p_updated_by, updated_by)
  WHERE  id = p_id
    AND  (p_expected_updated_at IS NULL OR updated_at = p_expected_updated_at);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    -- Two reasons we may match 0 rows:
    --   (a) the id does not exist
    --   (b) the row exists but updated_at does not match
    -- Distinguish them so the client gets a useful message.
    IF NOT EXISTS (SELECT 1 FROM zona WHERE id = p_id) THEN
      RAISE EXCEPTION 'Zona % no encontrada', p_id
        USING ERRCODE = '02000'; -- no_data, mapped to 404 by errors.ts default
    ELSE
      RAISE EXCEPTION 'La zona ha sido modificada por otro usuario desde que la cargaste. Recarga la pagina para ver los cambios mas recientes.'
        USING ERRCODE = '40001'; -- serialization_failure → 409 in errors.ts
    END IF;
  END IF;

  -- Sync translations: non-empty entries upsert, empty entries delete.
  -- (Same semantics as Tanda 3 C6 saveTranslations fix.)
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

COMMENT ON FUNCTION update_zona(UUID, TEXT, UUID, JSONB, UUID, TIMESTAMPTZ) IS
  'Atomic update of a zona with optimistic concurrency control. If '
  'p_expected_updated_at is provided and the row has been modified since '
  'then, raises SQLSTATE 40001 (serialization_failure) which the Edge '
  'Function maps to HTTP 409 Conflict.';

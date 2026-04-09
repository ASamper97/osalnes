-- Rollback for migration 016 — restore the previous update_zona signature
-- without the optimistic concurrency parameter. Identical to the body
-- defined in migration 015.

CREATE OR REPLACE FUNCTION update_zona(
  p_id           UUID,
  p_slug         TEXT,
  p_municipio_id UUID,
  p_name         JSONB,
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
  IF p_slug IS NOT NULL OR p_municipio_id IS NOT NULL OR p_updated_by IS NOT NULL THEN
    UPDATE zona
    SET    slug         = COALESCE(p_slug, slug),
           municipio_id = COALESCE(p_municipio_id, municipio_id),
           updated_by   = COALESCE(p_updated_by, updated_by)
    WHERE  id = p_id;
  END IF;

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

-- Drop the new 6-arg signature so the rollback leaves only the old one.
DROP FUNCTION IF EXISTS update_zona(UUID, TEXT, UUID, JSONB, UUID, TIMESTAMPTZ);

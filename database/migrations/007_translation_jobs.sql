-- =============================================================================
-- Migracion 007: Cola de trabajos de traduccion automatica
-- =============================================================================

CREATE TABLE translation_job (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidad_tipo    VARCHAR(50) NOT NULL,
    entidad_id      UUID NOT NULL,
    campo           VARCHAR(100) NOT NULL,
    idioma_origen   VARCHAR(5) NOT NULL DEFAULT 'es',
    idioma_destino  VARCHAR(5) NOT NULL,
    texto_origen    TEXT NOT NULL,
    texto_traducido TEXT,
    estado          VARCHAR(20) DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'en_proceso', 'completado', 'error', 'omitido')),
    intentos        INTEGER DEFAULT 0,
    max_intentos    INTEGER DEFAULT 3,
    error_msg       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    -- Idempotency: only one pending job per entity+field+target language
    UNIQUE(entidad_tipo, entidad_id, campo, idioma_destino, estado)
);

CREATE INDEX idx_tjob_pendiente ON translation_job(estado) WHERE estado = 'pendiente';
CREATE INDEX idx_tjob_entidad ON translation_job(entidad_tipo, entidad_id);
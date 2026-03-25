-- =============================================================================
-- Migracion 006: Tabla de log del asistente IA
-- =============================================================================

CREATE TABLE assistant_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID,
    lang                VARCHAR(5),
    user_message        TEXT NOT NULL,
    assistant_reply     TEXT,
    recursos_sugeridos  JSONB,
    tokens_used         INTEGER,
    duration_ms         INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assistant_log_session ON assistant_log(session_id);
CREATE INDEX idx_assistant_log_fecha ON assistant_log(created_at);

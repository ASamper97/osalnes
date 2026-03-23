-- =============================================================================
-- SEED: Usuario administrador inicial
-- Password: cambiar en produccion
-- =============================================================================

INSERT INTO usuario (email, nombre, rol, activo) VALUES
    ('admin@osalnes.gal', 'Administrador DTI Salnes', 'admin', true)
ON CONFLICT (email) DO NOTHING;

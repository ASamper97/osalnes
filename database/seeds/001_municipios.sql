-- =============================================================================
-- SEED: Municipios de la Mancomunidad de O Salnes
-- =============================================================================

INSERT INTO municipio (codigo_ine, slug, latitude, longitude) VALUES
    ('36008', 'cambados',            42.5145, -8.8141),
    ('36020', 'o-grove',             42.4944, -8.8639),
    ('36026', 'a-illa-de-arousa',    42.5633, -8.8644),
    ('36029', 'meano',               42.4440, -8.7765),
    ('36034', 'meis',                42.4907, -8.7458),
    ('36046', 'ribadumia',           42.5022, -8.7760),
    ('36051', 'sanxenxo',            42.3986, -8.8048),
    ('36060', 'vilagarcia-de-arousa', 42.5946, -8.7672),
    ('36062', 'vilanova-de-arousa',  42.5614, -8.8270),
    ('00001', 'otro',                NULL,    NULL),
    ('00002', 'varios',              NULL,    NULL)
ON CONFLICT (codigo_ine) DO NOTHING;

-- Traducciones de municipios (ES)
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'municipio', m.id, 'name', 'es', n.name_es
FROM municipio m
JOIN (VALUES
    ('36008', 'Cambados'),
    ('36020', 'O Grove'),
    ('36026', 'A Illa de Arousa'),
    ('36029', 'Meaño'),
    ('36034', 'Meis'),
    ('36046', 'Ribadumia'),
    ('36051', 'Sanxenxo'),
    ('36060', 'Vilagarcía de Arousa'),
    ('36062', 'Vilanova de Arousa'),
    ('00001', 'Otro'),
    ('00002', 'Varios')
) AS n(codigo_ine, name_es) ON m.codigo_ine = n.codigo_ine
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- Traducciones de municipios (GL)
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'municipio', m.id, 'name', 'gl', n.name_gl
FROM municipio m
JOIN (VALUES
    ('36008', 'Cambados'),
    ('36020', 'O Grove'),
    ('36026', 'A Illa de Arousa'),
    ('36029', 'Meaño'),
    ('36034', 'Meis'),
    ('36046', 'Ribadumia'),
    ('36051', 'Sanxenxo'),
    ('36060', 'Vilagarcía de Arousa'),
    ('36062', 'Vilanova de Arousa'),
    ('00001', 'Outro'),
    ('00002', 'Varios')
) AS n(codigo_ine, name_gl) ON m.codigo_ine = n.codigo_ine
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

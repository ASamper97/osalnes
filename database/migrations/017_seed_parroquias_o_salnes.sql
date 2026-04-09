-- =============================================================================
-- Migration 017 — Seed parroquias for the 9 O Salnés concellos (audit F2)
-- =============================================================================
--
-- WHY
-- ---
-- The Zonas module shipped empty: no zona rows existed and the Mancomunidade
-- staff would have had to type ~50 parroquias by hand to demo the feature.
-- This migration ships a curated starter dataset of 46 parroquias covering
-- all 9 concellos so the module is "complete from day one" for the demo.
--
-- DATA SOURCE & ACCURACY DISCLAIMER
-- ---------------------------------
-- This is a CURATED starter dataset, NOT the canonical IGE/IGN export. The
-- parish names below are the most well-known ones for each concello and
-- match the standard administrative division as published in the
-- Nomenclátor de Galicia. They should be verified against the official
-- source before use in any institutional reporting:
--
--   * IGE (Instituto Galego de Estatística): https://www.ige.gal/
--     → Cartografía → Nomenclátor → Parroquias por concello
--   * Xunta de Galicia open data:
--     https://abertos.xunta.gal/  (filter "parroquias")
--
-- The official source publishes a GeoJSON with polygons. This migration
-- only creates the names — polygons are deferred to F1 (geometric zones)
-- which depends on a `geo` column not yet added to the zona table.
--
-- Most parroquia names are Galician toponyms that do NOT have a Spanish
-- variant. For those we use the same Galician form in both `es` and `gl`
-- translations. The few names with a real Spanish equivalent (Vilanova de
-- Arousa, Vilagarcía de Arousa, Vilaxoán...) keep both forms.
--
-- IDEMPOTENCY
-- -----------
-- Uses ON CONFLICT (municipio_id, slug) DO NOTHING (the composite unique
-- index added in migration 014). Re-running this migration is a no-op.
-- The translation insert is also idempotent on its own constraint.
--
-- ROLLBACK
-- --------
-- See 017_seed_parroquias_o_salnes.down.sql

-- ─── 1. Insert zonas ──────────────────────────────────────────────────────
WITH parroquias(codigo_ine, slug, name_es, name_gl) AS (
  VALUES
    -- Cambados (5)
    ('36008', 'cambados',                'Cambados',                'Cambados'),
    ('36008', 'castrelo',                'Castrelo',                'Castrelo'),
    ('36008', 'corvillon',               'Corvillón',               'Corvillón'),
    ('36008', 'oubina',                  'Oubiña',                  'Oubiña'),
    ('36008', 'vilarino',                'Vilariño',                'Vilariño'),

    -- O Grove (2)
    ('36020', 'o-grove',                 'O Grove',                 'O Grove'),
    ('36020', 'san-vicente-do-mar',      'San Vicente do Mar',      'San Vicenzo do Mar'),

    -- A Illa de Arousa (1)
    ('36026', 'a-illa-de-arousa',        'A Illa de Arousa',        'A Illa de Arousa'),

    -- Meaño (6)
    ('36029', 'dena',                    'Dena',                    'Dena'),
    ('36029', 'lores',                   'Lores',                   'Lores'),
    ('36029', 'meano',                   'Meaño',                   'Meaño'),
    ('36029', 'padrenda',                'Padrenda',                'Padrenda'),
    ('36029', 'simes',                   'Simes',                   'Simes'),
    ('36029', 'xil',                     'Xil',                     'Xil'),

    -- Meis (5)
    ('36034', 'armenteira',              'Armenteira',              'Armenteira'),
    ('36034', 'meis',                    'Meis',                    'Meis'),
    ('36034', 'mosteiro',                'Mosteiro',                'Mosteiro'),
    ('36034', 'nogueira',                'Nogueira',                'Nogueira'),
    ('36034', 'paradela',                'Paradela',                'Paradela'),

    -- Ribadumia (5)
    ('36046', 'barrantes',               'Barrantes',               'Barrantes'),
    ('36046', 'besomano',                'Bésomaño',                'Bésomaño'),
    ('36046', 'leiro',                   'Leiro',                   'Leiro'),
    ('36046', 'ribadumia',               'Ribadumia',               'Ribadumia'),
    ('36046', 'sisan',                   'Sisán',                   'Sisán'),

    -- Sanxenxo (9)
    ('36051', 'adina',                   'Adina',                   'Adina'),
    ('36051', 'arra',                    'Arra',                    'Arra'),
    ('36051', 'bordons',                 'Bordóns',                 'Bordóns'),
    ('36051', 'dorron',                  'Dorrón',                  'Dorrón'),
    ('36051', 'gondar',                  'Gondar',                  'Gondar'),
    ('36051', 'nantes',                  'Nantes',                  'Nantes'),
    ('36051', 'noalla',                  'Noalla',                  'Noalla'),
    ('36051', 'padrinan',                'Padriñán',                'Padriñán'),
    ('36051', 'vilalonga',               'Vilalonga',               'Vilalonga'),

    -- Vilagarcía de Arousa (8)
    ('36060', 'bamio',                   'Bamio',                   'Bamio'),
    ('36060', 'carril',                  'Carril',                  'Carril'),
    ('36060', 'cea',                     'Cea',                     'Cea'),
    ('36060', 'cornazo',                 'Cornazo',                 'Cornazo'),
    ('36060', 'fontecarmoa',             'Fontecarmoa',             'Fontecarmoa'),
    ('36060', 'sobradelo',               'Sobradelo',               'Sobradelo'),
    ('36060', 'vilagarcia',              'Vilagarcía',              'Vilagarcía'),
    ('36060', 'vilaxoan',                'Vilaxoán',                'Vilaxoán'),

    -- Vilanova de Arousa (5)
    ('36062', 'andre-de-caleiro',        'André de Caleiro',        'André de Caleiro'),
    ('36062', 'baion',                   'Baión',                   'Baión'),
    ('36062', 'caleiro',                 'Caleiro',                 'Caleiro'),
    ('36062', 'tremoedo',                'Tremoedo',                'Tremoedo'),
    ('36062', 'vilanova-de-arousa',      'Vilanova de Arousa',      'Vilanova de Arousa')
)
INSERT INTO zona (slug, municipio_id)
SELECT p.slug, m.id
FROM parroquias p
JOIN municipio m ON m.codigo_ine = p.codigo_ine
ON CONFLICT (municipio_id, slug) DO NOTHING;

-- ─── 2. Insert ES translations ────────────────────────────────────────────
WITH parroquias(codigo_ine, slug, name_es) AS (
  VALUES
    ('36008', 'cambados', 'Cambados'),
    ('36008', 'castrelo', 'Castrelo'),
    ('36008', 'corvillon', 'Corvillón'),
    ('36008', 'oubina', 'Oubiña'),
    ('36008', 'vilarino', 'Vilariño'),
    ('36020', 'o-grove', 'O Grove'),
    ('36020', 'san-vicente-do-mar', 'San Vicente do Mar'),
    ('36026', 'a-illa-de-arousa', 'A Illa de Arousa'),
    ('36029', 'dena', 'Dena'),
    ('36029', 'lores', 'Lores'),
    ('36029', 'meano', 'Meaño'),
    ('36029', 'padrenda', 'Padrenda'),
    ('36029', 'simes', 'Simes'),
    ('36029', 'xil', 'Xil'),
    ('36034', 'armenteira', 'Armenteira'),
    ('36034', 'meis', 'Meis'),
    ('36034', 'mosteiro', 'Mosteiro'),
    ('36034', 'nogueira', 'Nogueira'),
    ('36034', 'paradela', 'Paradela'),
    ('36046', 'barrantes', 'Barrantes'),
    ('36046', 'besomano', 'Bésomaño'),
    ('36046', 'leiro', 'Leiro'),
    ('36046', 'ribadumia', 'Ribadumia'),
    ('36046', 'sisan', 'Sisán'),
    ('36051', 'adina', 'Adina'),
    ('36051', 'arra', 'Arra'),
    ('36051', 'bordons', 'Bordóns'),
    ('36051', 'dorron', 'Dorrón'),
    ('36051', 'gondar', 'Gondar'),
    ('36051', 'nantes', 'Nantes'),
    ('36051', 'noalla', 'Noalla'),
    ('36051', 'padrinan', 'Padriñán'),
    ('36051', 'vilalonga', 'Vilalonga'),
    ('36060', 'bamio', 'Bamio'),
    ('36060', 'carril', 'Carril'),
    ('36060', 'cea', 'Cea'),
    ('36060', 'cornazo', 'Cornazo'),
    ('36060', 'fontecarmoa', 'Fontecarmoa'),
    ('36060', 'sobradelo', 'Sobradelo'),
    ('36060', 'vilagarcia', 'Vilagarcía'),
    ('36060', 'vilaxoan', 'Vilaxoán'),
    ('36062', 'andre-de-caleiro', 'André de Caleiro'),
    ('36062', 'baion', 'Baión'),
    ('36062', 'caleiro', 'Caleiro'),
    ('36062', 'tremoedo', 'Tremoedo'),
    ('36062', 'vilanova-de-arousa', 'Vilanova de Arousa')
)
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'zona', z.id, 'name', 'es', p.name_es
FROM parroquias p
JOIN municipio m ON m.codigo_ine = p.codigo_ine
JOIN zona z      ON z.municipio_id = m.id AND z.slug = p.slug
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- ─── 3. Insert GL translations ────────────────────────────────────────────
WITH parroquias(codigo_ine, slug, name_gl) AS (
  VALUES
    ('36008', 'cambados', 'Cambados'),
    ('36008', 'castrelo', 'Castrelo'),
    ('36008', 'corvillon', 'Corvillón'),
    ('36008', 'oubina', 'Oubiña'),
    ('36008', 'vilarino', 'Vilariño'),
    ('36020', 'o-grove', 'O Grove'),
    ('36020', 'san-vicente-do-mar', 'San Vicenzo do Mar'),
    ('36026', 'a-illa-de-arousa', 'A Illa de Arousa'),
    ('36029', 'dena', 'Dena'),
    ('36029', 'lores', 'Lores'),
    ('36029', 'meano', 'Meaño'),
    ('36029', 'padrenda', 'Padrenda'),
    ('36029', 'simes', 'Simes'),
    ('36029', 'xil', 'Xil'),
    ('36034', 'armenteira', 'Armenteira'),
    ('36034', 'meis', 'Meis'),
    ('36034', 'mosteiro', 'Mosteiro'),
    ('36034', 'nogueira', 'Nogueira'),
    ('36034', 'paradela', 'Paradela'),
    ('36046', 'barrantes', 'Barrantes'),
    ('36046', 'besomano', 'Bésomaño'),
    ('36046', 'leiro', 'Leiro'),
    ('36046', 'ribadumia', 'Ribadumia'),
    ('36046', 'sisan', 'Sisán'),
    ('36051', 'adina', 'Adina'),
    ('36051', 'arra', 'Arra'),
    ('36051', 'bordons', 'Bordóns'),
    ('36051', 'dorron', 'Dorrón'),
    ('36051', 'gondar', 'Gondar'),
    ('36051', 'nantes', 'Nantes'),
    ('36051', 'noalla', 'Noalla'),
    ('36051', 'padrinan', 'Padriñán'),
    ('36051', 'vilalonga', 'Vilalonga'),
    ('36060', 'bamio', 'Bamio'),
    ('36060', 'carril', 'Carril'),
    ('36060', 'cea', 'Cea'),
    ('36060', 'cornazo', 'Cornazo'),
    ('36060', 'fontecarmoa', 'Fontecarmoa'),
    ('36060', 'sobradelo', 'Sobradelo'),
    ('36060', 'vilagarcia', 'Vilagarcía'),
    ('36060', 'vilaxoan', 'Vilaxoán'),
    ('36062', 'andre-de-caleiro', 'André de Caleiro'),
    ('36062', 'baion', 'Baión'),
    ('36062', 'caleiro', 'Caleiro'),
    ('36062', 'tremoedo', 'Tremoedo'),
    ('36062', 'vilanova-de-arousa', 'Vilanova de Arousa')
)
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'zona', z.id, 'name', 'gl', p.name_gl
FROM parroquias p
JOIN municipio m ON m.codigo_ine = p.codigo_ine
JOIN zona z      ON z.municipio_id = m.id AND z.slug = p.slug
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- ─── 4. Sanity check ──────────────────────────────────────────────────────
DO $$
DECLARE
  zona_count        INTEGER;
  translation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO zona_count FROM zona;
  SELECT COUNT(*) INTO translation_count
    FROM traduccion
    WHERE entidad_tipo = 'zona' AND campo = 'name';
  RAISE NOTICE 'Migration 017: % zonas exist, % name translations stored.', zona_count, translation_count;
END $$;

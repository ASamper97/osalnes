-- Rollback for migration 017 — remove the seeded parroquias and their
-- translations.
--
-- WARNING: this only deletes rows whose slug matches one of the seed
-- entries AND that have NULL created_by (i.e. seed-inserted, not edited
-- by a user). Zones with the same slug that were created or edited by
-- a real user are PRESERVED — we never want a rollback to destroy
-- legitimate operator work.

WITH seeded(codigo_ine, slug) AS (
  VALUES
    ('36008', 'cambados'), ('36008', 'castrelo'), ('36008', 'corvillon'),
    ('36008', 'oubina'), ('36008', 'vilarino'),
    ('36020', 'o-grove'), ('36020', 'san-vicente-do-mar'),
    ('36026', 'a-illa-de-arousa'),
    ('36029', 'dena'), ('36029', 'lores'), ('36029', 'meano'),
    ('36029', 'padrenda'), ('36029', 'simes'), ('36029', 'xil'),
    ('36034', 'armenteira'), ('36034', 'meis'), ('36034', 'mosteiro'),
    ('36034', 'nogueira'), ('36034', 'paradela'),
    ('36046', 'barrantes'), ('36046', 'besomano'), ('36046', 'leiro'),
    ('36046', 'ribadumia'), ('36046', 'sisan'),
    ('36051', 'adina'), ('36051', 'arra'), ('36051', 'bordons'),
    ('36051', 'dorron'), ('36051', 'gondar'), ('36051', 'nantes'),
    ('36051', 'noalla'), ('36051', 'padrinan'), ('36051', 'vilalonga'),
    ('36060', 'bamio'), ('36060', 'carril'), ('36060', 'cea'),
    ('36060', 'cornazo'), ('36060', 'fontecarmoa'), ('36060', 'sobradelo'),
    ('36060', 'vilagarcia'), ('36060', 'vilaxoan'),
    ('36062', 'andre-de-caleiro'), ('36062', 'baion'), ('36062', 'caleiro'),
    ('36062', 'tremoedo'), ('36062', 'vilanova-de-arousa')
),
to_delete AS (
  SELECT z.id
  FROM zona z
  JOIN municipio m ON m.id = z.municipio_id
  JOIN seeded   s ON s.codigo_ine = m.codigo_ine AND s.slug = z.slug
  WHERE z.created_by IS NULL  -- skip rows touched by a real user
)
DELETE FROM traduccion
WHERE entidad_tipo = 'zona'
  AND entidad_id IN (SELECT id FROM to_delete);

WITH seeded(codigo_ine, slug) AS (
  VALUES
    ('36008', 'cambados'), ('36008', 'castrelo'), ('36008', 'corvillon'),
    ('36008', 'oubina'), ('36008', 'vilarino'),
    ('36020', 'o-grove'), ('36020', 'san-vicente-do-mar'),
    ('36026', 'a-illa-de-arousa'),
    ('36029', 'dena'), ('36029', 'lores'), ('36029', 'meano'),
    ('36029', 'padrenda'), ('36029', 'simes'), ('36029', 'xil'),
    ('36034', 'armenteira'), ('36034', 'meis'), ('36034', 'mosteiro'),
    ('36034', 'nogueira'), ('36034', 'paradela'),
    ('36046', 'barrantes'), ('36046', 'besomano'), ('36046', 'leiro'),
    ('36046', 'ribadumia'), ('36046', 'sisan'),
    ('36051', 'adina'), ('36051', 'arra'), ('36051', 'bordons'),
    ('36051', 'dorron'), ('36051', 'gondar'), ('36051', 'nantes'),
    ('36051', 'noalla'), ('36051', 'padrinan'), ('36051', 'vilalonga'),
    ('36060', 'bamio'), ('36060', 'carril'), ('36060', 'cea'),
    ('36060', 'cornazo'), ('36060', 'fontecarmoa'), ('36060', 'sobradelo'),
    ('36060', 'vilagarcia'), ('36060', 'vilaxoan'),
    ('36062', 'andre-de-caleiro'), ('36062', 'baion'), ('36062', 'caleiro'),
    ('36062', 'tremoedo'), ('36062', 'vilanova-de-arousa')
)
DELETE FROM zona z
USING municipio m, seeded s
WHERE m.id = z.municipio_id
  AND s.codigo_ine = m.codigo_ine
  AND s.slug = z.slug
  AND z.created_by IS NULL;

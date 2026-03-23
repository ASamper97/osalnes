-- =============================================================================
-- FIX: Corregir tildes en municipios y añadir Otro/Varios
-- =============================================================================

-- 1. Corregir "Meano" → "Meaño" en traducciones
UPDATE traduccion
SET valor = 'Meaño'
WHERE entidad_tipo = 'municipio'
  AND campo = 'name'
  AND valor = 'Meano';

-- 2. Corregir "Vilagarcia de Arousa" → "Vilagarcía de Arousa" en traducciones
UPDATE traduccion
SET valor = 'Vilagarcía de Arousa'
WHERE entidad_tipo = 'municipio'
  AND campo = 'name'
  AND valor = 'Vilagarcia de Arousa';

-- 3. Añadir municipio "Otro"
INSERT INTO municipio (codigo_ine, slug, latitude, longitude)
VALUES ('00001', 'otro', NULL, NULL)
ON CONFLICT (codigo_ine) DO NOTHING;

INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'municipio', m.id, 'name', 'es', 'Otro'
FROM municipio m WHERE m.codigo_ine = '00001'
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'municipio', m.id, 'name', 'gl', 'Outro'
FROM municipio m WHERE m.codigo_ine = '00001'
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- 4. Añadir municipio "Varios"
INSERT INTO municipio (codigo_ine, slug, latitude, longitude)
VALUES ('00002', 'varios', NULL, NULL)
ON CONFLICT (codigo_ine) DO NOTHING;

INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'municipio', m.id, 'name', 'es', 'Varios'
FROM municipio m WHERE m.codigo_ine = '00002'
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'municipio', m.id, 'name', 'gl', 'Varios'
FROM municipio m WHERE m.codigo_ine = '00002'
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

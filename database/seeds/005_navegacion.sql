-- =============================================================================
-- SEED: Navegacion principal de la web
-- =============================================================================

-- Menu principal
INSERT INTO navegacion (menu_slug, tipo, referencia, orden, visible) VALUES
    ('main', 'categoria', 'que-ver',     1, true),
    ('main', 'categoria', 'que-hacer',   2, true),
    ('main', 'categoria', 'donde-comer', 3, true),
    ('main', 'categoria', 'donde-dormir',4, true),
    ('main', 'categoria', 'agenda',      5, true),
    ('main', 'categoria', 'informacion', 6, true);

-- Traducciones de items del menu
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'navegacion', n.id, 'label', lang.idioma, lang.valor
FROM navegacion n
JOIN (VALUES
    ('que-ver',     'es', 'Que ver'),       ('que-ver',     'gl', 'Que ver'),
    ('que-hacer',   'es', 'Que hacer'),     ('que-hacer',   'gl', 'Que facer'),
    ('donde-comer', 'es', 'Donde comer'),   ('donde-comer', 'gl', 'Onde comer'),
    ('donde-dormir','es', 'Donde dormir'),  ('donde-dormir','gl', 'Onde durmir'),
    ('agenda',      'es', 'Agenda'),        ('agenda',      'gl', 'Axenda'),
    ('informacion', 'es', 'Informacion'),   ('informacion', 'gl', 'Informacion')
) AS lang(ref, idioma, valor) ON n.referencia = lang.ref
WHERE n.menu_slug = 'main'
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

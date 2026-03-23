-- =============================================================================
-- SEED: Categorias iniciales del destino O Salnes
-- =============================================================================

-- Categorias raiz
INSERT INTO categoria (slug, orden) VALUES
    ('que-ver',       1),
    ('que-hacer',     2),
    ('donde-comer',   3),
    ('donde-dormir',  4),
    ('agenda',        5),
    ('informacion',   6)
ON CONFLICT (slug) DO NOTHING;

-- Subcategorias: Que ver
INSERT INTO categoria (slug, parent_id, orden) VALUES
    ('playas',          (SELECT id FROM categoria WHERE slug = 'que-ver'), 1),
    ('patrimonio',      (SELECT id FROM categoria WHERE slug = 'que-ver'), 2),
    ('naturaleza',      (SELECT id FROM categoria WHERE slug = 'que-ver'), 3),
    ('miradores',       (SELECT id FROM categoria WHERE slug = 'que-ver'), 4),
    ('museos',          (SELECT id FROM categoria WHERE slug = 'que-ver'), 5),
    ('iglesias',        (SELECT id FROM categoria WHERE slug = 'que-ver'), 6)
ON CONFLICT (slug) DO NOTHING;

-- Subcategorias: Que hacer
INSERT INTO categoria (slug, parent_id, orden) VALUES
    ('rutas',           (SELECT id FROM categoria WHERE slug = 'que-hacer'), 1),
    ('deportes',        (SELECT id FROM categoria WHERE slug = 'que-hacer'), 2),
    ('enoturismo',      (SELECT id FROM categoria WHERE slug = 'que-hacer'), 3),
    ('gastronomia',     (SELECT id FROM categoria WHERE slug = 'que-hacer'), 4),
    ('actividades-mar', (SELECT id FROM categoria WHERE slug = 'que-hacer'), 5)
ON CONFLICT (slug) DO NOTHING;

-- Traducciones categorias raiz
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'categoria', c.id, 'name', lang.idioma, lang.valor
FROM categoria c
JOIN (VALUES
    ('que-ver',     'es', 'Que ver'),       ('que-ver',     'gl', 'Que ver'),
    ('que-hacer',   'es', 'Que hacer'),     ('que-hacer',   'gl', 'Que facer'),
    ('donde-comer', 'es', 'Donde comer'),   ('donde-comer', 'gl', 'Onde comer'),
    ('donde-dormir','es', 'Donde dormir'),  ('donde-dormir','gl', 'Onde durmir'),
    ('agenda',      'es', 'Agenda'),        ('agenda',      'gl', 'Axenda'),
    ('informacion', 'es', 'Informacion'),   ('informacion', 'gl', 'Informacion')
) AS lang(slug, idioma, valor) ON c.slug = lang.slug
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- Traducciones subcategorias
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'categoria', c.id, 'name', lang.idioma, lang.valor
FROM categoria c
JOIN (VALUES
    ('playas',     'es', 'Playas'),         ('playas',     'gl', 'Praias'),
    ('patrimonio', 'es', 'Patrimonio'),     ('patrimonio', 'gl', 'Patrimonio'),
    ('naturaleza', 'es', 'Naturaleza'),     ('naturaleza', 'gl', 'Natureza'),
    ('miradores',  'es', 'Miradores'),      ('miradores',  'gl', 'Miradoiros'),
    ('museos',     'es', 'Museos'),         ('museos',     'gl', 'Museos'),
    ('iglesias',   'es', 'Iglesias'),       ('iglesias',   'gl', 'Igrexas'),
    ('rutas',      'es', 'Rutas'),          ('rutas',      'gl', 'Rutas'),
    ('deportes',   'es', 'Deportes'),       ('deportes',   'gl', 'Deportes'),
    ('enoturismo', 'es', 'Enoturismo'),     ('enoturismo', 'gl', 'Enoturismo'),
    ('gastronomia','es', 'Gastronomia'),    ('gastronomia','gl', 'Gastronomia'),
    ('actividades-mar', 'es', 'Actividades en el mar'), ('actividades-mar', 'gl', 'Actividades no mar')
) AS lang(slug, idioma, valor) ON c.slug = lang.slug
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- =============================================================================
-- SEED: 15 recursos turisticos reales de O Salnes (demo)
-- =============================================================================

-- Insertar recursos vinculados a municipios reales por codigo_ine
-- Todos en estado 'publicado' y visibles en mapa

INSERT INTO recurso_turistico (uri, rdf_type, slug, municipio_id, latitude, longitude, address_street, address_postal, telephone, email, url, tourist_types, rating_value, opening_hours, visible_en_mapa, estado_editorial, published_at)
SELECT
  'osalnes:recurso:' || v.slug,
  v.rdf_type, v.slug,
  m.id, v.lat, v.lng,
  v.address, v.postal, v.phone, v.mail, v.web,
  v.tourist_types, v.rating, v.hours,
  true, 'publicado', NOW()
FROM (VALUES
  -- PLAYAS
  ('praia-a-lanzada', 'Beach', '36051', 42.4310, -8.8726, 'Praia de A Lanzada', '36989', ARRAY['986 720 075'], ARRAY['turismo@sanxenxo.gal'], 'https://turismo.sanxenxo.gal', ARRAY['BEACH AND SUN TOURISM', 'NATURE TOURISM'], NULL::int, 'Libre acceso 24h'),
  ('praia-areas', 'Beach', '36051', 42.3800, -8.8366, 'Praia de Areas, Sanxenxo', '36960', ARRAY['986 720 075'], ARRAY['turismo@sanxenxo.gal'], 'https://turismo.sanxenxo.gal', ARRAY['BEACH AND SUN TOURISM'], NULL, 'Libre acceso 24h'),
  ('praia-da-barrosa', 'Beach', '36051', 42.3563, -8.8242, 'Playa de La Barrosa, Portonovo', '36970', ARRAY[]::varchar[], ARRAY[]::varchar[], NULL, ARRAY['BEACH AND SUN TOURISM', 'WATER SPORTS TOURISM'], NULL, 'Libre acceso 24h'),
  ('praia-o-vao', 'Beach', '36060', 42.5896, -8.7913, 'Praia de O Vao, Vilagarcia', '36611', ARRAY[]::varchar[], ARRAY[]::varchar[], NULL, ARRAY['BEACH AND SUN TOURISM', 'FAMILY TOURISM'], NULL, 'Libre acceso 24h'),

  -- ALOJAMIENTO
  ('parador-de-cambados', 'Hotel', '36008', 42.5155, -8.8123, 'Paseo de Cervantes s/n', '36630', ARRAY['986 542 250'], ARRAY['cambados@parador.es'], 'https://www.parador.es/es/paradores/parador-de-cambados', ARRAY['CULTURAL TOURISM', 'WINE TOURISM'], 4, 'Recepcion 24h'),
  ('hotel-spa-nanin-playa', 'Hotel', '36051', 42.3978, -8.8089, 'Playa de Nanin s/n', '36960', ARRAY['986 691 050'], ARRAY['info@naninplaya.com'], 'https://www.naninplaya.com', ARRAY['WELLNESS TOURISM', 'BEACH AND SUN TOURISM'], 4, 'Recepcion 24h'),
  ('camping-paisaxe', 'Campground', '36020', 42.4846, -8.8774, 'Lugar de Reboredo 5', '36988', ARRAY['986 731 404'], ARRAY['info@campingpaisaxe.com'], 'https://www.campingpaisaxe.com', ARRAY['NATURE TOURISM', 'FAMILY TOURISM'], 2, 'Abr-Oct 08:00-22:00'),

  -- RESTAURACION
  ('restaurante-yayo-daporta', 'Restaurant', '36008', 42.5140, -8.8138, 'Rua do Hospital 7', '36630', ARRAY['986 526 062'], ARRAY['info@yayodaporta.com'], 'https://www.yayodaporta.com', ARRAY['FOOD TOURISM', 'WINE TOURISM'], 5, 'Ma-Sa 13:30-15:30, 21:00-23:00'),
  ('restaurante-d-berto', 'Restaurant', '36020', 42.4958, -8.8666, 'Avenida Teniente Dominguez 84', '36980', ARRAY['986 733 447'], ARRAY[]::varchar[], NULL, ARRAY['FOOD TOURISM'], 3, 'Lu-Do 12:00-16:00, 20:00-23:30'),
  ('marisqueria-pepe-vieira', 'Restaurant', '36046', 42.5053, -8.7827, 'Lugar de Rua 2, Herbón', '36636', ARRAY['986 710 050'], ARRAY['info@pepevieira.com'], 'https://www.pepevieira.com', ARRAY['FOOD TOURISM', 'WINE TOURISM'], 5, 'Mi-Do 13:30-15:30, 20:30-22:30'),

  -- ATRACCIONES
  ('pazo-de-fefinans', 'LandmarksOrHistoricalBuildings', '36008', 42.5132, -8.8139, 'Praza de Fefinans s/n', '36630', ARRAY['986 542 204'], ARRAY['info@fefinanes.com'], 'https://www.fefinanes.com', ARRAY['CULTURAL TOURISM', 'HERITAGE TOURISM', 'WINE TOURISM'], NULL, 'Lu-Vi 10:00-14:00, 16:00-19:00'),
  ('illa-de-arousa-ponte', 'TouristAttraction', '36026', 42.5633, -8.8644, 'Ponte da Illa de Arousa', '36626', ARRAY[]::varchar[], ARRAY[]::varchar[], NULL, ARRAY['NATURE TOURISM', 'CYCLING TOURISM'], NULL, 'Acceso libre 24h'),
  ('torre-de-san-sadurnino', 'LandmarksOrHistoricalBuildings', '36008', 42.5110, -8.8145, 'Rua de San Sadurnino', '36630', ARRAY[]::varchar[], ARRAY[]::varchar[], NULL, ARRAY['CULTURAL TOURISM', 'HERITAGE TOURISM'], NULL, 'Exterior: acceso libre'),
  ('mirador-da-siradella', 'ViewPoint', '36051', 42.3938, -8.8278, 'Alto da Siradella', '36960', ARRAY[]::varchar[], ARRAY[]::varchar[], NULL, ARRAY['NATURE TOURISM', 'PHOTOGRAPHY TOURISM'], NULL, 'Acceso libre 24h'),

  -- EVENTO
  ('festa-do-albarino', 'Festival', '36008', 42.5145, -8.8141, 'Praza de Fefinans, Cambados', '36630', ARRAY['986 520 786'], ARRAY['turismo@cambados.gal'], 'https://www.festadoalbarino.com', ARRAY['FOOD TOURISM', 'WINE TOURISM', 'EVENTS AND FESTIVALS TOURISM'], NULL, 'Primer domingo de agosto (5 dias)')
) AS v(slug, rdf_type, ine, lat, lng, address, postal, phone, mail, web, tourist_types, rating, hours)
JOIN municipio m ON m.codigo_ine = v.ine
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- Traducciones (ES)
-- =============================================================================

INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'recurso_turistico', r.id, 'name', 'es', n.name_es
FROM recurso_turistico r
JOIN (VALUES
  ('praia-a-lanzada',            'Playa de A Lanzada'),
  ('praia-areas',                'Playa de Areas'),
  ('praia-da-barrosa',           'Playa de La Barrosa'),
  ('praia-o-vao',                'Playa de O Vao'),
  ('parador-de-cambados',        'Parador de Cambados'),
  ('hotel-spa-nanin-playa',      'Hotel Spa Nanin Playa'),
  ('camping-paisaxe',            'Camping Paisaxe II'),
  ('restaurante-yayo-daporta',   'Restaurante Yayo Daporta'),
  ('restaurante-d-berto',        'Restaurante D Berto'),
  ('marisqueria-pepe-vieira',    'Marisqueria Pepe Vieira'),
  ('pazo-de-fefinans',           'Pazo de Fefinans'),
  ('illa-de-arousa-ponte',       'Puente de A Illa de Arousa'),
  ('torre-de-san-sadurnino',     'Torre de San Sadurnino'),
  ('mirador-da-siradella',       'Mirador de A Siradella'),
  ('festa-do-albarino',          'Festa do Albarino')
) AS n(slug, name_es) ON r.slug = n.slug
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- =============================================================================
-- Traducciones (GL)
-- =============================================================================

INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'recurso_turistico', r.id, 'name', 'gl', n.name_gl
FROM recurso_turistico r
JOIN (VALUES
  ('praia-a-lanzada',            'Praia de A Lanzada'),
  ('praia-areas',                'Praia de Areas'),
  ('praia-da-barrosa',           'Praia da Barrosa'),
  ('praia-o-vao',                'Praia de O Vao'),
  ('parador-de-cambados',        'Parador de Cambados'),
  ('hotel-spa-nanin-playa',      'Hotel Spa Nanin Praia'),
  ('camping-paisaxe',            'Camping Paisaxe II'),
  ('restaurante-yayo-daporta',   'Restaurante Yayo Daporta'),
  ('restaurante-d-berto',        'Restaurante D Berto'),
  ('marisqueria-pepe-vieira',    'Marisqueria Pepe Vieira'),
  ('pazo-de-fefinans',           'Pazo de Fefinans'),
  ('illa-de-arousa-ponte',       'Ponte da Illa de Arousa'),
  ('torre-de-san-sadurnino',     'Torre de San Sadurnino'),
  ('mirador-da-siradella',       'Miradoiro da Siradella'),
  ('festa-do-albarino',          'Festa do Albarino')
) AS n(slug, name_gl) ON r.slug = n.slug
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

-- =============================================================================
-- Descripciones (ES)
-- =============================================================================

INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'recurso_turistico', r.id, 'description', 'es', d.desc_es
FROM recurso_turistico r
JOIN (VALUES
  ('praia-a-lanzada',            'Extensa playa de mas de 2 km de arena fina y aguas cristalinas. Uno de los areales mas espectaculares de Galicia, entre la ria de Arousa y el oceano Atlantico. Ideal para surf y deportes acuaticos.'),
  ('praia-areas',                'Playa urbana de Sanxenxo con bandera azul. Arena blanca, aguas tranquilas y todos los servicios. Paseo maritimo con terrazas y ambiente familiar.'),
  ('praia-da-barrosa',           'Playa de ambiente joven en Portonovo con excelentes condiciones para el surf. Chiringuitos y escuelas de deportes nauticos.'),
  ('praia-o-vao',                'Playa familiar en Vilagarcia de Arousa con aguas tranquilas y poco profundas. Zona de juegos infantiles y aparcamiento gratuito.'),
  ('parador-de-cambados',        'Parador Nacional ubicado en el Pazo de Bazan, edificio senorial del siglo XVII. Gastronomia gallega de autor con vinos albarinos de la zona. Jardin con vistas a la ria.'),
  ('hotel-spa-nanin-playa',      'Hotel de 4 estrellas a pie de playa en Sanxenxo con spa y centro de bienestar. Piscina exterior, restaurante con cocina gallega contemporanea.'),
  ('camping-paisaxe',            'Camping de 2 estrellas en O Grove rodeado de naturaleza. Parcelas amplias, piscina, restaurante y acceso directo a senderos costeros.'),
  ('restaurante-yayo-daporta',   'Restaurante con estrella Michelin en el corazon de Cambados. Cocina gallega de vanguardia con productos del mar de las rias. Carta de vinos albarinos excepcional.'),
  ('restaurante-d-berto',        'Marisqueria mitica de O Grove. Marisco fresco del dia, percebes, navajas y centollo. Ambiente marinero autentico desde 1975.'),
  ('marisqueria-pepe-vieira',    'Restaurante con dos estrellas Michelin del chef Xose Torres Cannas. Alta cocina gallega en un entorno rural con vistas al rio Umia. Experiencia gastronomica unica.'),
  ('pazo-de-fefinans',           'Pazo senorial del siglo XVI en la plaza principal de Cambados. Sede de la bodega Palacio de Fefinanes, una de las mas antiguas de Rias Baixas. Visitas guiadas con cata de albarino.'),
  ('illa-de-arousa-ponte',       'Puente de 2 km que une la Illa de Arousa con el continente. Carril bici y paseo peatonal con vistas panoramicas a la ria. Atardecer espectacular.'),
  ('torre-de-san-sadurnino',     'Torre medieval del siglo X, uno de los monumentos mas antiguos de Cambados. Declarada Bien de Interes Cultural. Restos arquitectonicos romanicos.'),
  ('mirador-da-siradella',       'Punto panoramico con vistas de 360 grados sobre la ria de Pontevedra, las islas Cies y la costa de Sanxenxo. Acceso en coche o a pie por sendero forestal.'),
  ('festa-do-albarino',          'Fiesta de Interes Turistico Internacional celebrada en Cambados desde 1953. Cinco dias de catas, musica, gastronomia y cultura en torno al vino albarino. Primer domingo de agosto.')
) AS d(slug, desc_es) ON r.slug = d.slug
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

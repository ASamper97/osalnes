-- =============================================================================
-- SEED: Tipologias UNE 178503 seccion 7.5
-- =============================================================================

INSERT INTO tipologia (type_code, schema_org_type, grupo) VALUES
    -- Alojamientos
    ('Hotel',              'Hotel',              'alojamiento'),
    ('RuralHouse',         'House',              'alojamiento'),
    ('BedAndBreakfast',    'BedAndBreakfast',    'alojamiento'),
    ('Campground',         'Campground',         'alojamiento'),
    ('Apartment',          'Apartment',          'alojamiento'),
    ('Hostel',             'Hostel',             'alojamiento'),
    ('ApartHotel',         'LodgingBusiness',    'alojamiento'),
    ('GuestHouse',         'House',              'alojamiento'),
    ('RuralHotel',         'Hotel',              'alojamiento'),
    ('LodgingBusiness',    'LodgingBusiness',    'alojamiento'),

    -- Restauracion
    ('Restaurant',         'Restaurant',         'restauracion'),
    ('BarOrPub',           'BarOrPub',           'restauracion'),
    ('CafeOrCoffeeShop',   'CafeOrCoffeeShop',   'restauracion'),
    ('Winery',             'Winery',             'restauracion'),
    ('Brewery',            'Brewery',            'restauracion'),
    ('IceCreamShop',       'IceCreamShop',       'restauracion'),

    -- Recursos turisticos y ocio
    ('TouristAttraction',  'TouristAttraction',  'recurso'),
    ('Beach',              'Beach',              'recurso'),
    ('PlaceOfWorship',     'PlaceOfWorship',     'recurso'),
    ('CivilBuilding',      'LandmarksOrHistoricalBuildings', 'recurso'),
    ('MilitaryBuilding',   'LandmarksOrHistoricalBuildings', 'recurso'),
    ('Museum',             'Museum',             'recurso'),
    ('Park',               'Park',               'recurso'),
    ('NaturePark',         'Place',              'recurso'),
    ('ViewPoint',          'Place',              'recurso'),
    ('LandmarksOrHistoricalBuildings', 'LandmarksOrHistoricalBuildings', 'recurso'),
    ('BodyOfWater',        'BodyOfWater',        'recurso'),
    ('Mountain',           'Mountain',           'recurso'),
    ('Trail',              'SportsActivityLocation', 'recurso'),
    ('Square',             'TouristAttraction',  'recurso'),
    ('Street',             'TouristAttraction',  'recurso'),
    ('District',           'TouristAttraction',  'recurso'),
    ('Cave',               'Landform',           'recurso'),
    ('Waterfall',          'Waterfall',          'recurso'),
    ('SportsActivityLocation', 'SportsActivityLocation', 'recurso'),
    ('ShoppingCenter',     'ShoppingCenter',     'recurso'),
    ('ArtGallery',         'ArtGallery',         'recurso'),
    ('Library',            'Library',            'recurso'),
    ('CultureCenter',      'CivicStructure',     'recurso'),
    ('GolfCourse',         'GolfCourse',         'recurso'),
    ('WaterActivityCenter','SportsActivityLocation', 'recurso'),
    ('YachtingPort',       'CivicStructure',     'recurso'),
    ('Aquarium',           'Aquarium',           'recurso'),

    -- Eventos
    ('Event',              'Event',              'evento'),
    ('Festival',           'Festival',           'evento'),
    ('TraditionalFestival','Festival',           'evento'),
    ('FoodEvent',          'FoodEvent',          'evento'),
    ('MusicEvent',         'MusicEvent',         'evento'),
    ('SportsEvent',        'SportsEvent',        'evento'),
    ('ExhibitionEvent',    'ExhibitionEvent',    'evento'),
    ('BusinessEvent',      'BusinessEvent',      'evento'),
    ('Fair',               'Event',              'evento'),

    -- Transporte
    ('BusStation',         'BusStation',         'transporte'),
    ('BusStop',            'BusStop',            'transporte'),
    ('Port',               'CivicStructure',     'transporte'),
    ('TaxiStand',          'TaxiStand',          'transporte'),
    ('ParkingFacility',    'ParkingFacility',    'transporte'),
    ('TrainStation',       'TrainStation',       'transporte'),

    -- Informacion y servicios
    ('TouristInformationCenter', 'TouristInformationCenter', 'servicio'),
    ('TravelAgency',       'TravelAgency',       'servicio'),
    ('GasStation',         'GasStation',         'servicio'),
    ('FinancialService',   'FinancialService',   'servicio'),
    ('Hospital',           'Hospital',           'servicio'),
    ('Pharmacy',           'Pharmacy',           'servicio'),
    ('PoliceStation',      'PoliceStation',      'servicio'),

    -- General
    ('TouristDestination', 'TouristDestination', 'general'),
    ('TouristTrip',        'TouristTrip',        'general'),
    ('Offer',              'Offer',              'general'),
    ('Organization',       'Organization',       'general')
ON CONFLICT (type_code) DO NOTHING;

-- Traducciones de tipologias (es)
INSERT INTO traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
SELECT 'tipologia', t.id, 'name', 'es', n.nombre_es
FROM tipologia t
JOIN (VALUES
    ('Hotel', 'Hotel'), ('RuralHouse', 'Casa rural'), ('BedAndBreakfast', 'Bed & Breakfast'),
    ('Campground', 'Camping'), ('Apartment', 'Apartamento'), ('Hostel', 'Hostal'),
    ('Restaurant', 'Restaurante'), ('BarOrPub', 'Bar'), ('CafeOrCoffeeShop', 'Cafeteria'),
    ('Winery', 'Bodega'), ('TouristAttraction', 'Atractivo turistico'), ('Beach', 'Playa'),
    ('PlaceOfWorship', 'Edificio religioso'), ('CivilBuilding', 'Edificio civil'),
    ('MilitaryBuilding', 'Edificio militar'), ('Museum', 'Museo'), ('Park', 'Parque'),
    ('NaturePark', 'Parque natural'), ('ViewPoint', 'Mirador'),
    ('LandmarksOrHistoricalBuildings', 'Lugar historico'), ('BodyOfWater', 'Agua'),
    ('Mountain', 'Montana'), ('Trail', 'Sendero'), ('Square', 'Plaza'), ('Street', 'Calle'),
    ('Event', 'Evento'), ('Festival', 'Festival'), ('TraditionalFestival', 'Fiesta tradicional'),
    ('FoodEvent', 'Evento gastronomico'), ('MusicEvent', 'Concierto'),
    ('SportsEvent', 'Evento deportivo'), ('BusStation', 'Estacion de autobus'),
    ('Port', 'Puerto'), ('TouristInformationCenter', 'Oficina de turismo'),
    ('TouristDestination', 'Destino turistico'), ('TouristTrip', 'Ruta turistica'),
    ('Offer', 'Oferta'), ('Organization', 'Organizacion'),
    ('ShoppingCenter', 'Zona comercial'), ('SportsActivityLocation', 'Instalacion deportiva'),
    ('ArtGallery', 'Galeria de arte'), ('Library', 'Biblioteca'),
    ('YachtingPort', 'Puerto deportivo'), ('Aquarium', 'Acuario')
) AS n(type_code, nombre_es) ON t.type_code = n.type_code
ON CONFLICT (entidad_tipo, entidad_id, campo, idioma) DO NOTHING;

import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { supabase } from '../db/supabase.js';
import * as resourceService from '../services/resource.service.js';
import { getTranslatedField, getTranslations } from '../services/translation.service.js';

export const publicRouter = Router();

// ==========================================================================
// Recursos turisticos
// ==========================================================================

/** GET /api/v1/resources */
publicRouter.get(
  '/resources',
  asyncHandler(async (req, res) => {
    const result = await resourceService.listResources({
      type: req.query.type as string | undefined,
      municipio: req.query.municipio as string | undefined,
      lang: req.query.lang as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      sort: req.query.sort as string | undefined,
    });
    res.json(result);
  }),
);

/** GET /api/v1/resources/:id */
publicRouter.get(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    const resource = await resourceService.getResourceById(req.params.id as string);
    res.json(resource);
  }),
);

/** GET /api/v1/resources/by-slug/:slug */
publicRouter.get(
  '/resources/by-slug/:slug',
  asyncHandler(async (req, res) => {
    const resource = await resourceService.getResourceBySlug(req.params.slug as string);
    res.json(resource);
  }),
);

// ==========================================================================
// Tipologias
// ==========================================================================

/** GET /api/v1/typologies */
publicRouter.get(
  '/typologies',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('tipologia')
      .select('id, type_code, schema_org_type, grupo')
      .order('grupo')
      .order('type_code');

    if (error) throw error;

    const items = await Promise.all(
      (data || []).map(async (r) => ({
        id: r.id,
        typeCode: r.type_code,
        schemaOrgType: r.schema_org_type,
        grupo: r.grupo,
        name: await getTranslatedField('tipologia', r.id, 'name'),
      })),
    );
    res.json(items);
  }),
);

// ==========================================================================
// Categorias
// ==========================================================================

/** GET /api/v1/categories */
publicRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('categoria')
      .select('id, slug, parent_id, orden')
      .order('orden');

    if (error) throw error;

    const items = await Promise.all(
      (data || []).map(async (r) => ({
        id: r.id,
        slug: r.slug,
        parentId: r.parent_id,
        orden: r.orden,
        name: await getTranslatedField('categoria', r.id, 'name'),
      })),
    );
    res.json(items);
  }),
);

/** GET /api/v1/categories/:slug */
publicRouter.get(
  '/categories/:slug',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('categoria')
      .select('id, slug, parent_id, orden')
      .eq('slug', req.params.slug)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json({
      id: data.id,
      slug: data.slug,
      parentId: data.parent_id,
      orden: data.orden,
      name: await getTranslatedField('categoria', data.id, 'name'),
    });
  }),
);

// ==========================================================================
// Municipios
// ==========================================================================

/** GET /api/v1/municipalities */
publicRouter.get(
  '/municipalities',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('municipio')
      .select('id, codigo_ine, slug, latitude, longitude')
      .order('slug');

    if (error) throw error;

    const items = await Promise.all(
      (data || []).map(async (r) => ({
        id: r.id,
        codigoIne: r.codigo_ine,
        slug: r.slug,
        latitude: r.latitude,
        longitude: r.longitude,
        name: await getTranslatedField('municipio', r.id, 'name'),
      })),
    );
    res.json(items);
  }),
);

// ==========================================================================
// Paginas
// ==========================================================================

/** GET /api/v1/pages/:slug */
publicRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('pagina')
      .select('id, slug, template')
      .eq('slug', req.params.slug)
      .eq('publicada', true)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const translations = await getTranslations('pagina', data.id);
    res.json({
      id: data.id,
      slug: data.slug,
      template: data.template,
      title: translations.title || {},
      body: translations.body || {},
      seoTitle: translations.seo_title || {},
      seoDescription: translations.seo_description || {},
    });
  }),
);

// ==========================================================================
// Navegacion
// ==========================================================================

/** GET /api/v1/navigation/:menuSlug */
publicRouter.get(
  '/navigation/:menuSlug',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('navegacion')
      .select('id, tipo, referencia, orden')
      .eq('menu_slug', req.params.menuSlug)
      .eq('visible', true)
      .order('orden');

    if (error) throw error;

    const items = await Promise.all(
      (data || []).map(async (r) => ({
        id: r.id,
        tipo: r.tipo,
        referencia: r.referencia,
        orden: r.orden,
        label: await getTranslatedField('navegacion', r.id, 'label'),
      })),
    );
    res.json(items);
  }),
);

// ==========================================================================
// Zonas
// ==========================================================================

/** GET /api/v1/zones */
publicRouter.get(
  '/zones',
  asyncHandler(async (req, res) => {
    const municipio = req.query.municipio as string | undefined;

    let query = supabase
      .from('zona')
      .select('id, slug, municipio_id')
      .order('slug');

    if (municipio) {
      query = query.eq('municipio_id', municipio);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = await Promise.all(
      (data || []).map(async (r) => ({
        id: r.id,
        slug: r.slug,
        municipioId: r.municipio_id,
        name: await getTranslatedField('zona', r.id, 'name'),
      })),
    );
    res.json(items);
  }),
);

// ==========================================================================
// Eventos
// ==========================================================================

/** GET /api/v1/events */
publicRouter.get(
  '/events',
  asyncHandler(async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    let query = supabase
      .from('recurso_turistico')
      .select(`id, uri, slug, tipologia:tipo_id ( type_code ), latitude, longitude`)
      .eq('estado_editorial', 'publicado');

    if (from) query = query.gte('updated_at', from);
    if (to) query = query.lte('updated_at', to);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;

    res.json(data);
  }),
);

// ==========================================================================
// Mapa
// ==========================================================================

/** GET /api/v1/map/resources */
publicRouter.get(
  '/map/resources',
  asyncHandler(async (req, res) => {
    const bounds = (req.query.bounds as string || '').split(',').map(Number);
    if (bounds.length !== 4 || bounds.some(isNaN)) {
      res.status(400).json({ error: 'bounds must be lat_sw,lng_sw,lat_ne,lng_ne' });
      return;
    }
    const [latSw, lngSw, latNe, lngNe] = bounds;
    const type = req.query.type as string | undefined;
    const municipio = req.query.municipio as string | undefined;

    let query = supabase
      .from('recurso_turistico')
      .select(`id, slug, rdf_type, latitude, longitude, address_street, tipologia:rdf_type ( type_code, grupo )`)
      .eq('estado_editorial', 'publicado')
      .eq('visible_en_mapa', true)
      .gte('latitude', latSw)
      .lte('latitude', latNe)
      .gte('longitude', lngSw)
      .lte('longitude', lngNe);

    if (type) {
      query = query.eq('rdf_type', type);
    }
    if (municipio) {
      query = query.eq('municipio_id', municipio);
    }

    const { data, error } = await query.limit(500);
    if (error) throw error;

    const rows = data || [];

    // Batch-fetch translated names for all resources in one query
    const ids = rows.map((r) => r.id);
    let nameMap: Record<string, Record<string, string>> = {};
    if (ids.length > 0) {
      const { data: translations } = await supabase
        .from('traduccion')
        .select('entidad_id, idioma, valor')
        .eq('entidad_tipo', 'recurso_turistico')
        .eq('campo', 'name')
        .in('entidad_id', ids);

      for (const t of translations || []) {
        if (!nameMap[t.entidad_id]) nameMap[t.entidad_id] = {};
        nameMap[t.entidad_id][t.idioma] = t.valor;
      }
    }

    const items = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: nameMap[r.id] || {},
      rdfType: r.rdf_type,
      grupo: (r.tipologia as any)?.grupo || null,
      location: {
        latitude: r.latitude,
        longitude: r.longitude,
        streetAddress: r.address_street,
      },
    }));

    res.json(items);
  }),
);

// ==========================================================================
// Busqueda
// ==========================================================================

/** GET /api/v1/search */
publicRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = req.query.q as string;
    const lang = req.query.lang as string | undefined;
    const type = req.query.type as string | undefined;
    const municipio = req.query.municipio as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (!q || q.length < 2) {
      res.json({ items: [], total: 0, page, limit, pages: 0 });
      return;
    }

    // E1: busqueda por traduccion ILIKE via Supabase (name + description)
    // E2: se migrara a Meilisearch para full-text search
    let translationQuery = supabase
      .from('traduccion')
      .select('entidad_id')
      .eq('entidad_tipo', 'recurso_turistico')
      .in('campo', ['name', 'description'])
      .ilike('valor', `%${q}%`);

    if (lang) {
      translationQuery = translationQuery.eq('idioma', lang);
    }

    const { data, error } = await translationQuery.limit(200);
    if (error) throw error;

    const ids = [...new Set((data || []).map((r) => r.entidad_id))];

    if (ids.length === 0) {
      res.json({ items: [], total: 0, page, limit, pages: 0 });
      return;
    }

    // Fetch matching published resources with filters
    let resourceQuery = supabase
      .from('recurso_turistico')
      .select(`id, uri, slug, rdf_type, municipio_id, latitude, longitude, tipologia:rdf_type ( type_code, schema_org_type )`, { count: 'exact' })
      .in('id', ids)
      .eq('estado_editorial', 'publicado');

    if (type) {
      resourceQuery = resourceQuery.eq('rdf_type', type);
    }
    if (municipio) {
      resourceQuery = resourceQuery.eq('municipio_id', municipio);
    }

    const offset = (page - 1) * limit;
    const { data: resources, count } = await resourceQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const total = count || 0;

    // Enrich with translated name
    const items = await Promise.all(
      (resources || []).map(async (r) => ({
        id: r.id,
        uri: r.uri,
        slug: r.slug,
        tipologia: r.tipologia,
        municipioId: r.municipio_id,
        latitude: r.latitude,
        longitude: r.longitude,
        name: await getTranslatedField('recurso_turistico', r.id, 'name'),
      })),
    );

    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  }),
);

// ==========================================================================
// Exportacion JSON-LD (UNE 178503 + schema.org)
// ==========================================================================

/** Schema.org type mapping */
const SCHEMA_ORG_MAP: Record<string, string> = {
  Hotel: 'Hotel', RuralHouse: 'House', BedAndBreakfast: 'BedAndBreakfast',
  Campground: 'Campground', Apartment: 'Apartment', Hostel: 'Hostel',
  ApartHotel: 'LodgingBusiness', GuestHouse: 'LodgingBusiness', RuralHotel: 'LodgingBusiness',
  LodgingBusiness: 'LodgingBusiness',
  Restaurant: 'Restaurant', BarOrPub: 'BarOrPub', CafeOrCoffeeShop: 'CafeOrCoffeeShop',
  Winery: 'Winery', Brewery: 'Brewery', IceCreamShop: 'FoodEstablishment',
  TouristAttraction: 'TouristAttraction', Beach: 'Beach', Museum: 'Museum',
  Park: 'Park', NaturePark: 'Park', ViewPoint: 'Place',
  PlaceOfWorship: 'PlaceOfWorship', Trail: 'TouristAttraction',
  LandmarksOrHistoricalBuildings: 'LandmarksOrHistoricalBuildings',
  Monument: 'LandmarksOrHistoricalBuildings', Cave: 'TouristAttraction',
  ArtGallery: 'ArtGallery', Library: 'Library', GolfCourse: 'GolfCourse',
  YachtingPort: 'BoatTerminal', Zoo: 'Zoo', Aquarium: 'Aquarium',
  Event: 'Event', Festival: 'Festival', MusicEvent: 'MusicEvent',
  SportsEvent: 'SportsEvent', FoodEvent: 'FoodEvent', Fair: 'Event',
  BusStation: 'BusStation', Port: 'BoatTerminal', TrainStation: 'TrainStation',
  ParkingFacility: 'ParkingFacility', TaxiStand: 'TaxiStand',
  TouristInformationCenter: 'TouristInformationCenter',
  Hospital: 'Hospital', Pharmacy: 'Pharmacy', PoliceStation: 'PoliceStation',
  GasStation: 'GasStation', TouristDestination: 'TouristDestination',
};

/** GET /api/v1/export/jsonld — Public JSON-LD export of all published resources */
publicRouter.get(
  '/export/jsonld',
  asyncHandler(async (req, res) => {
    const type = req.query.type as string | undefined;
    const municipio = req.query.municipio as string | undefined;

    // Fetch all published resources
    let query = supabase
      .from('recurso_turistico')
      .select(`
        id, uri, rdf_type, slug, latitude, longitude,
        address_street, address_postal, telephone, email, url,
        tourist_types, rating_value, serves_cuisine, opening_hours,
        is_accessible_for_free, public_access, occupancy,
        extras, municipio_id, published_at, updated_at
      `)
      .eq('estado_editorial', 'publicado');

    if (type) query = query.eq('rdf_type', type);
    if (municipio) query = query.eq('municipio_id', municipio);

    const { data: resources, error } = await query.order('updated_at', { ascending: false });
    if (error) throw error;

    const rows = resources || [];

    // Batch-fetch all translations (fix N+1)
    const ids = rows.map((r) => r.id);
    let tMap: Record<string, Record<string, Record<string, string>>> = {};

    if (ids.length > 0) {
      const { data: translations } = await supabase
        .from('traduccion')
        .select('entidad_id, campo, idioma, valor')
        .eq('entidad_tipo', 'recurso_turistico')
        .in('campo', ['name', 'description'])
        .in('entidad_id', ids);

      for (const t of translations || []) {
        if (!tMap[t.entidad_id]) tMap[t.entidad_id] = {};
        if (!tMap[t.entidad_id][t.campo]) tMap[t.entidad_id][t.campo] = {};
        tMap[t.entidad_id][t.campo][t.idioma] = t.valor;
      }
    }

    // Fetch municipality slugs for addressLocality
    const muniIds = [...new Set(rows.map((r) => r.municipio_id).filter(Boolean))];
    let muniMap: Record<string, string> = {};
    if (muniIds.length > 0) {
      const { data: munis } = await supabase.from('municipio').select('id, slug').in('id', muniIds);
      for (const m of munis || []) { muniMap[m.id] = m.slug; }
    }

    // Build JSON-LD graph
    const graph = rows.map((r) => {
      const names = tMap[r.id]?.name || {};
      const descs = tMap[r.id]?.description || {};
      const schemaType = SCHEMA_ORG_MAP[r.rdf_type] || 'TouristAttraction';

      const item: Record<string, unknown> = {
        '@type': schemaType,
        '@id': `https://turismo.osalnes.gal/es/recurso/${r.slug}`,
        'identifier': r.uri,
        'url': `https://turismo.osalnes.gal/es/recurso/${r.slug}`,
      };

      // Name — prefer es, fallback to gl
      if (names.es) item.name = names.es;
      else if (names.gl) item.name = names.gl;

      // Description
      if (descs.es) item.description = descs.es;
      else if (descs.gl) item.description = descs.gl;

      // Multilingual names as alternateName
      const altNames = Object.entries(names).filter(([lang]) => lang !== 'es').map(([, v]) => v);
      if (altNames.length > 0) item.alternateName = altNames;

      // Geo
      if (r.latitude && r.longitude) {
        item.geo = {
          '@type': 'GeoCoordinates',
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
        };
      }

      // Address
      if (r.address_street || r.address_postal || r.municipio_id) {
        item.address = {
          '@type': 'PostalAddress',
          ...(r.address_street && { streetAddress: r.address_street }),
          ...(r.address_postal && { postalCode: r.address_postal }),
          ...(r.municipio_id && muniMap[r.municipio_id] && { addressLocality: muniMap[r.municipio_id] }),
          addressRegion: 'Pontevedra',
          addressCountry: 'ES',
        };
      }

      // Contact
      if (r.telephone?.length) item.telephone = r.telephone.length === 1 ? r.telephone[0] : r.telephone;
      if (r.email?.length) item.email = r.email.length === 1 ? r.email[0] : r.email;
      if (r.url) item.url = r.url;

      // Rating (UNE 178503 sec. 7.7)
      if (r.rating_value) {
        item.starRating = { '@type': 'Rating', ratingValue: r.rating_value };
      }

      // Tourist types (UNE 178503 sec. 7.6)
      if (r.tourist_types?.length) item.touristType = r.tourist_types;

      // Cuisine
      if (r.serves_cuisine?.length) item.servesCuisine = r.serves_cuisine;

      // Opening hours
      if (r.opening_hours) item.openingHours = r.opening_hours;

      // Accessibility
      if (r.is_accessible_for_free !== null) item.isAccessibleForFree = r.is_accessible_for_free;
      if (r.public_access !== null) item.publicAccess = r.public_access;
      if (r.occupancy) item.maximumAttendeeCapacity = r.occupancy;

      // Dates
      if (r.published_at) item.datePublished = r.published_at;
      if (r.updated_at) item.dateModified = r.updated_at;

      return item;
    });

    res.setHeader('Content-Type', 'application/ld+json; charset=utf-8');
    res.json({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': 'Recursos Turisticos — O Salnes DTI',
      'description': 'Catalogo de recursos turisticos de la Mancomunidad de O Salnes, segun UNE 178503',
      'numberOfItems': graph.length,
      'itemListElement': graph.map((item, i) => ({
        '@type': 'ListItem',
        'position': i + 1,
        'item': item,
      })),
    });
  }),
);

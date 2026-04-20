/**
 * Public API — Supabase Edge Function
 * Replaces packages/api/src/routes/public.ts (Express).
 *
 * Invoked at: https://<ref>.supabase.co/functions/v1/api/<path>
 */
import { handleCors, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase.ts';
import { getTranslations, getTranslatedField } from '../_shared/translations.ts';
import { routePath, matchRoute } from '../_shared/router.ts';
import { formatError } from '../_shared/errors.ts';
import { rateLimit } from '../_shared/rate-limit.ts';
import { listZones as listZonesShared } from '../_shared/zones.ts';
import { verifyAuth } from '../_shared/auth.ts';

const FN = 'api';

Deno.serve(async (req: Request) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const path = routePath(url, FN);
  const method = req.method;

  try {
    // Per-IP rate limit (120 req/min). Public API but still bounded to
    // prevent runaway clients exhausting DB connections.
    rateLimit(req);

    // ====================================================================
    // Health
    // ====================================================================
    if (method === 'GET' && (path === '/health' || path === '/')) {
      return json({ status: 'ok', fn: FN }, 200, req);
    }

    // ====================================================================
    // Recursos turísticos
    // ====================================================================

    // GET /resources
    if (method === 'GET' && path === '/resources') {
      return await listResources(url, req);
    }

    // GET /resources/by-slug/:slug  (must be before /resources/:id)
    const bySlug = matchRoute('/resources/by-slug/:slug', path);
    if (method === 'GET' && bySlug) {
      return await getResourceBySlug(bySlug.slug, req);
    }

    // GET /resources/:id
    const resId = matchRoute('/resources/:id', path);
    if (method === 'GET' && resId) {
      return await getResourceById(resId.id, req);
    }

    // ====================================================================
    // Tipologías
    // ====================================================================
    if (method === 'GET' && path === '/typologies') {
      return await listTypologies(req);
    }

    // ====================================================================
    // Categorías
    // ====================================================================
    if (method === 'GET' && path === '/categories') {
      return await listCategories(req);
    }
    const catSlug = matchRoute('/categories/:slug', path);
    if (method === 'GET' && catSlug) {
      return await getCategoryBySlug(catSlug.slug, req);
    }

    // ====================================================================
    // Municipios
    // ====================================================================
    if (method === 'GET' && path === '/municipalities') {
      return await listMunicipalities(req);
    }

    // ====================================================================
    // Páginas
    // ====================================================================
    const pageSlug = matchRoute('/pages/:slug', path);
    if (method === 'GET' && pageSlug) {
      return await getPage(pageSlug.slug, req);
    }

    // ====================================================================
    // Navegación
    // ====================================================================
    const navMenu = matchRoute('/navigation/:menuSlug', path);
    if (method === 'GET' && navMenu) {
      return await getNavigation(navMenu.menuSlug, req);
    }

    // ====================================================================
    // Zonas
    // ====================================================================
    if (method === 'GET' && path === '/zones') {
      return await listZones(url, req);
    }

    // ====================================================================
    // Eventos
    // ====================================================================
    if (method === 'GET' && path === '/events') {
      return await listEvents(url, req);
    }

    // ====================================================================
    // Mapa
    // ====================================================================
    if (method === 'GET' && path === '/map/resources') {
      return await mapResources(url, req);
    }

    // ====================================================================
    // Búsqueda
    // ====================================================================
    if (method === 'GET' && path === '/search') {
      return await search(url, req);
    }

    // ====================================================================
    // Export JSON-LD
    // ====================================================================
    if (method === 'GET' && path === '/export/jsonld') {
      return await exportJsonLd(url, req);
    }

    return json({ error: 'Not found' }, 404, req);
  } catch (err: unknown) {
    const [body, status] = formatError(err);
    return json(body, status, req);
  }
});

// ========================================================================
// Handler implementations
// ========================================================================

async function listResources(url: URL, req: Request) {
  const sb = getAdminClient();
  const type = url.searchParams.get('type') || undefined;
  const municipio = url.searchParams.get('municipio') || undefined;
  // F3: filter by zona — used by the "click a zone → see its recursos" flow
  // from ZonesMapPage and ZonesPage. Receives a zona UUID.
  const zona = url.searchParams.get('zona') || undefined;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const sort = url.searchParams.get('sort') || 'created_at';

  const status = url.searchParams.get('status') || 'publicado';
  const nameQuery = url.searchParams.get('q') || undefined;

  // Lote 3b rediseño — filtro "mis recursos" (created_by = me) para que el
  // editor vea solo los suyos desde el listado del CMS. Acepta:
  //   created_by=me       → resuelve al usuario.id del JWT (requiere header)
  //   created_by=<uuid>   → literal (para admin u otras integraciones)
  //   created_by=null     → recursos sin autor (legacy pre-auth)
  // Si "me" viene sin Authorization válido, se ignora silenciosamente y el
  // endpoint responde su comportamiento público habitual.
  const createdByRaw = url.searchParams.get('created_by');
  let createdBy: string | 'null' | undefined;
  if (createdByRaw === 'me') {
    try {
      const authed = await verifyAuth(req);
      createdBy = authed.dbId;
    } catch {
      createdBy = undefined;
    }
  } else if (createdByRaw === 'null') {
    createdBy = 'null';
  } else if (createdByRaw) {
    createdBy = createdByRaw;
  }

  // If searching by name, first find matching IDs from translations.
  //
  // S9 — previous implementation had `.limit(100)` here which silently
  // truncated the result set. A search for "playa" with 200 matches showed
  // only the first 100 rows, paginated within those, so the user could
  // never reach matches 101–200 even with .range(). We removed the limit
  // and added a hard cap of 1000 (still safe; enough for the actual scale
  // and prevents pathological queries from loading the whole table).
  //
  // For a future scale > 1000 matches, switch to a trigram index
  // (CREATE EXTENSION pg_trgm + GIN index on traduccion.valor) and use
  // a single JOIN query instead of the two-step IN-list pattern.
  let matchingIds: string[] | undefined;
  if (nameQuery && nameQuery.length >= 2) {
    const { data: tData } = await sb
      .from('traduccion')
      .select('entidad_id')
      .eq('entidad_tipo', 'recurso_turistico')
      .eq('campo', 'name')
      .ilike('valor', `%${nameQuery}%`)
      .limit(1000);  // hard cap to prevent runaway scans, was 100
    matchingIds = [...new Set((tData || []).map((r) => r.entidad_id))];
    if (matchingIds.length === 0) {
      return json({ items: [], total: 0, page, limit, pages: 0 }, 200, req);
    }
  }

  let query = sb
    .from('recurso_turistico')
    .select('*', { count: 'exact' })
    .eq('estado_editorial', status);

  if (type) query = query.eq('rdf_type', type);
  if (municipio) query = query.eq('municipio_id', municipio);
  if (zona) query = query.eq('zona_id', zona);
  if (matchingIds) query = query.in('id', matchingIds);
  if (createdBy === 'null') query = query.is('created_by', null);
  else if (createdBy) query = query.eq('created_by', createdBy);

  const offset = (page - 1) * limit;
  const orderCol = sort === 'updated' ? 'updated_at' : 'created_at';
  query = query
    .order(orderCol, { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count || 0;
  const items = await Promise.all((data || []).map(mapResourceRow));

  return json({ items, total, page, limit, pages: Math.ceil(total / limit) }, 200, req);
}

async function getResourceById(id: string, req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('recurso_turistico')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return json({ error: 'Resource not found' }, 404, req);
  return json(await mapResourceRow(data), 200, req);
}

async function getResourceBySlug(slug: string, req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('recurso_turistico')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return json({ error: 'Resource not found' }, 404, req);
  return json(await mapResourceRow(data), 200, req);
}

async function listTypologies(req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
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
  return json(items, 200, req);
}

async function listCategories(req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
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
  return json(items, 200, req);
}

async function getCategoryBySlug(slug: string, req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('categoria')
    .select('id, slug, parent_id, orden')
    .eq('slug', slug)
    .single();

  if (error || !data) return json({ error: 'Category not found' }, 404, req);

  return json({
    id: data.id,
    slug: data.slug,
    parentId: data.parent_id,
    orden: data.orden,
    name: await getTranslatedField('categoria', data.id, 'name'),
  }, 200, req);
}

async function listMunicipalities(req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
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
  return json(items, 200, req);
}

async function getPage(slug: string, req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('pagina')
    .select('id, slug, template')
    .eq('slug', slug)
    .eq('publicada', true)
    .single();

  if (error || !data) return json({ error: 'Page not found' }, 404, req);

  const translations = await getTranslations('pagina', data.id);
  return json({
    id: data.id,
    slug: data.slug,
    template: data.template,
    title: translations.title || {},
    body: translations.body || {},
    seoTitle: translations.seo_title || {},
    seoDescription: translations.seo_description || {},
  }, 200, req);
}

async function getNavigation(menuSlug: string, req: Request) {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('navegacion')
    .select('id, tipo, referencia, orden')
    .eq('menu_slug', menuSlug)
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
  return json(items, 200, req);
}

async function listZones(url: URL, req: Request) {
  const sb = getAdminClient();
  const municipio = url.searchParams.get('municipio') || undefined;
  //
  // ─── Data flow contract (audit DF4 + DF5) ───────────────────────────────
  //
  // This is the PUBLIC zones endpoint. Three rules to keep in mind when
  // adding columns or changing how zones are filtered:
  //
  //   1. (DF4) When/if a `zona.activo` (or `status`) column is introduced
  //      to soft-disable zones (audit F6), this helper MUST add the filter
  //      to hide unpublished zones from the public web. The admin path in
  //      admin/index.ts can keep returning everything because admins need
  //      to manage drafts. The shared listZonesShared() helper does NOT
  //      filter — it is used by both admin and public, so the filter has
  //      to live in the caller (here).
  //
  //   2. (DF5) Migration 010 enabled RLS on every table with NO policies.
  //      That means anon access via PostgREST is denied. THIS endpoint uses
  //      service_role (getAdminClient) which bypasses RLS, so we are the
  //      single source of truth for "what can the public see". If you ever
  //      add an RLS policy on `zona` to allow anon SELECT (e.g. to enable
  //      realtime subscriptions for the web), the policy USING clause MUST
  //      mirror the filter applied here, otherwise the two paths will
  //      disagree and a row could be visible via direct REST but hidden
  //      via this endpoint (or vice-versa).
  //
  //   3. The shape returned (id, slug, municipioId, name, updatedAt) is
  //      consumed by both web/api-client.ts AND cms/api.ts. Adding new
  //      fields is safe; renaming or removing existing ones requires a
  //      coordinated frontend update.
  //
  const items = await listZonesShared(sb, municipio);
  return json(items, 200, req);
}

async function listEvents(url: URL, req: Request) {
  const sb = getAdminClient();
  const from = url.searchParams.get('from') || undefined;
  const to = url.searchParams.get('to') || undefined;

  let query = sb
    .from('recurso_turistico')
    .select('id, uri, slug, rdf_type, latitude, longitude')
    .eq('estado_editorial', 'publicado');

  if (from) query = query.gte('updated_at', from);
  if (to) query = query.lte('updated_at', to);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return json(data, 200, req);
}

async function mapResources(url: URL, req: Request) {
  const bounds = (url.searchParams.get('bounds') || '').split(',').map(Number);
  if (bounds.length !== 4 || bounds.some(isNaN)) {
    return json({ error: 'bounds must be lat_sw,lng_sw,lat_ne,lng_ne' }, 400, req);
  }

  const [latSw, latNe, lngSw, lngNe] = bounds;
  const type = url.searchParams.get('type') || undefined;
  const sb = getAdminClient();

  let query = sb
    .from('recurso_turistico')
    .select('id, uri, slug, rdf_type, latitude, longitude')
    .eq('estado_editorial', 'publicado')
    .eq('visible_en_mapa', true)
    .gte('latitude', latSw)
    .lte('latitude', latNe)
    .gte('longitude', lngSw)
    .lte('longitude', lngNe);

  if (type) query = query.eq('tipologia.type_code', type);

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return json(data, 200, req);
}

async function search(url: URL, req: Request) {
  const q = url.searchParams.get('q') || '';
  const lang = url.searchParams.get('lang') || undefined;
  const type = url.searchParams.get('type') || undefined;
  const municipio = url.searchParams.get('municipio') || undefined;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  if (q.length < 2) {
    return json({ items: [], total: 0, page, limit, pages: 0 }, 200, req);
  }

  const sb = getAdminClient();

  // Search translations
  let translationQuery = sb
    .from('traduccion')
    .select('entidad_id')
    .eq('entidad_tipo', 'recurso_turistico')
    .in('campo', ['name', 'description'])
    .ilike('valor', `%${q}%`);

  if (lang) translationQuery = translationQuery.eq('idioma', lang);

  const { data: tData, error: tErr } = await translationQuery.limit(200);
  if (tErr) throw tErr;

  const ids = [...new Set((tData || []).map((r) => r.entidad_id))];
  if (ids.length === 0) {
    return json({ items: [], total: 0, page, limit, pages: 0 }, 200, req);
  }

  // Fetch matching published resources
  let resourceQuery = sb
    .from('recurso_turistico')
    .select(
      'id, uri, slug, rdf_type, municipio_id, latitude, longitude',
      { count: 'exact' },
    )
    .in('id', ids)
    .eq('estado_editorial', 'publicado');

  if (type) resourceQuery = resourceQuery.eq('rdf_type', type);
  if (municipio) resourceQuery = resourceQuery.eq('municipio_id', municipio);

  const offset = (page - 1) * limit;
  const { data: resources, count } = await resourceQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const total = count || 0;

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

  return json({ items, total, page, limit, pages: Math.ceil(total / limit) }, 200, req);
}

// ========================================================================
// Shared resource mapper
// ========================================================================

// deno-lint-ignore no-explicit-any
async function mapResourceRow(row: Record<string, any>) {
  // ─── S11 — Data flow contract ──────────────────────────────────────
  //
  // This helper runs on the PUBLIC api Edge Function. It uses
  // getAdminClient() (service_role key), so it bypasses every RLS policy
  // on every table it touches. That is fine TODAY because:
  //   1. The caller (listResources, getResourceById...) already filters
  //      to estado_editorial='publicado' before calling this mapper.
  //   2. We do not return any column from the row that could leak the
  //      identity of the editor (created_by/updated_by are not in the
  //      output object below).
  //
  // If/when a future migration adds RLS policies on `recurso_turistico`
  // (e.g. to allow direct anon SELECT for realtime subscriptions), the
  // policy USING clause MUST mirror the filter applied by the caller.
  // Otherwise this helper will continue serving rows that the policy
  // would deny — silent privilege escalation via the public API.
  //
  // Audit P1 also lives here (N+1: 1 query base + 2 per row). Keeping
  // these two concerns documented together because they share the
  // same fix horizon (extract to _shared/resources.ts with batched
  // queries — same pattern we used for _shared/zones.ts in zonas A7).
  // ───────────────────────────────────────────────────────────────────

  const sb = getAdminClient();
  const translations = await getTranslations('recurso_turistico', row.id);

  const { data: cats } = await sb
    .from('recurso_categoria')
    .select('categoria_id')
    .eq('recurso_id', row.id);

  return {
    id: row.id,
    uri: row.uri,
    rdfType: row.rdf_type,
    slug: row.slug,
    name: translations.name || {},
    description: translations.description || {},
    seoTitle: translations.seo_title || {},
    seoDescription: translations.seo_description || {},
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      streetAddress: row.address_street,
      postalCode: row.address_postal,
    },
    municipioId: row.municipio_id,
    zonaId: row.zona_id,
    contact: {
      telephone: row.telephone || [],
      email: row.email || [],
      url: row.url,
      sameAs: row.same_as || [],
    },
    touristTypes: row.tourist_types || [],
    ratingValue: row.rating_value,
    servesCuisine: row.serves_cuisine || [],
    isAccessibleForFree: row.is_accessible_for_free,
    publicAccess: row.public_access,
    occupancy: row.occupancy,
    openingHours: row.opening_hours,
    extras: row.extras || {},
    status: row.estado_editorial,
    visibleOnMap: row.visible_en_mapa,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // deno-lint-ignore no-explicit-any
    categoryIds: (cats || []).map((c: any) => c.categoria_id),
  };
}

// ========================================================================
// JSON-LD Export (UNE 178503 + schema.org)
// ========================================================================

const SCHEMA_ORG_MAP: Record<string, string> = {
  Hotel: 'Hotel', RuralHouse: 'House', BedAndBreakfast: 'BedAndBreakfast',
  Campground: 'Campground', Apartment: 'Apartment', Hostel: 'Hostel',
  Restaurant: 'Restaurant', BarOrPub: 'BarOrPub', CafeOrCoffeeShop: 'CafeOrCoffeeShop',
  Winery: 'Winery', TouristAttraction: 'TouristAttraction', Beach: 'Beach',
  Museum: 'Museum', Park: 'Park', NaturePark: 'Park', ViewPoint: 'Place',
  PlaceOfWorship: 'PlaceOfWorship', LandmarksOrHistoricalBuildings: 'LandmarksOrHistoricalBuildings',
  Event: 'Event', Festival: 'Festival', MusicEvent: 'MusicEvent',
  SportsEvent: 'SportsEvent', TouristDestination: 'TouristDestination',
  BusStation: 'BusStation', Port: 'BoatTerminal', TrainStation: 'TrainStation',
  Hospital: 'Hospital', Pharmacy: 'Pharmacy',
  TouristInformationCenter: 'TouristInformationCenter',
};

async function exportJsonLd(url: URL, req: Request) {
  const sb = getAdminClient();
  const type = url.searchParams.get('type') || undefined;
  const municipio = url.searchParams.get('municipio') || undefined;

  let query = sb
    .from('recurso_turistico')
    .select(`
      id, uri, rdf_type, slug, latitude, longitude,
      address_street, address_postal, telephone, email, url,
      tourist_types, rating_value, serves_cuisine, opening_hours,
      is_accessible_for_free, public_access, occupancy,
      municipio_id, published_at, updated_at
    `)
    .eq('estado_editorial', 'publicado');

  if (type) query = query.eq('rdf_type', type);
  if (municipio) query = query.eq('municipio_id', municipio);

  const { data: resources, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;

  const rows = resources || [];

  // Batch translations
  const ids = rows.map((r) => r.id);
  // deno-lint-ignore no-explicit-any
  const tMap: Record<string, Record<string, Record<string, string>>> = {};

  if (ids.length > 0) {
    const { data: translations } = await sb
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

  // Municipality names
  const muniIds = [...new Set(rows.map((r) => r.municipio_id).filter(Boolean))];
  const muniMap: Record<string, string> = {};
  if (muniIds.length > 0) {
    const { data: munis } = await sb.from('municipio').select('id, slug').in('id', muniIds);
    for (const m of munis || []) { muniMap[m.id] = m.slug; }
  }

  // Build graph
  // deno-lint-ignore no-explicit-any
  const graph = rows.map((r: any) => {
    const names = tMap[r.id]?.name || {};
    const descs = tMap[r.id]?.description || {};
    const schemaType = SCHEMA_ORG_MAP[r.rdf_type] || 'TouristAttraction';

    // deno-lint-ignore no-explicit-any
    const item: Record<string, any> = {
      '@type': schemaType,
      '@id': `https://turismo.osalnes.gal/es/recurso/${r.slug}`,
      identifier: r.uri,
      url: `https://turismo.osalnes.gal/es/recurso/${r.slug}`,
    };

    if (names.es) item.name = names.es;
    else if (names.gl) item.name = names.gl;
    if (descs.es) item.description = descs.es;
    else if (descs.gl) item.description = descs.gl;

    const altNames = Object.entries(names).filter(([lang]) => lang !== 'es').map(([, v]) => v);
    if (altNames.length > 0) item.alternateName = altNames;

    if (r.latitude && r.longitude) {
      item.geo = { '@type': 'GeoCoordinates', latitude: Number(r.latitude), longitude: Number(r.longitude) };
    }
    if (r.address_street || r.address_postal) {
      item.address = {
        '@type': 'PostalAddress',
        ...(r.address_street && { streetAddress: r.address_street }),
        ...(r.address_postal && { postalCode: r.address_postal }),
        ...(r.municipio_id && muniMap[r.municipio_id] && { addressLocality: muniMap[r.municipio_id] }),
        addressRegion: 'Pontevedra', addressCountry: 'ES',
      };
    }
    if (r.telephone?.length) item.telephone = r.telephone.length === 1 ? r.telephone[0] : r.telephone;
    if (r.email?.length) item.email = r.email.length === 1 ? r.email[0] : r.email;
    if (r.rating_value) item.starRating = { '@type': 'Rating', ratingValue: r.rating_value };
    if (r.tourist_types?.length) item.touristType = r.tourist_types;
    if (r.serves_cuisine?.length) item.servesCuisine = r.serves_cuisine;
    if (r.opening_hours) item.openingHours = r.opening_hours;
    if (r.is_accessible_for_free !== null) item.isAccessibleForFree = r.is_accessible_for_free;
    if (r.published_at) item.datePublished = r.published_at;
    if (r.updated_at) item.dateModified = r.updated_at;

    return item;
  });

  return json({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Recursos Turisticos — O Salnes DTI',
    description: 'Catalogo de recursos turisticos de la Mancomunidad de O Salnes, segun UNE 178503',
    numberOfItems: graph.length,
    itemListElement: graph.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })),
  }, 200, req);
}

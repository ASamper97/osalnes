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

const FN = 'api';

Deno.serve(async (req: Request) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const path = routePath(url, FN);
  const method = req.method;

  try {
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

    return json({ error: 'Not found' }, 404, req);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return json(
      { error: e.message || 'Internal server error' },
      e.status || 500,
      req,
    );
  }
});

// ========================================================================
// Handler implementations
// ========================================================================

async function listResources(url: URL, req: Request) {
  const sb = getAdminClient();
  const type = url.searchParams.get('type') || undefined;
  const municipio = url.searchParams.get('municipio') || undefined;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const sort = url.searchParams.get('sort') || 'created_at';

  let query = sb
    .from('recurso_turistico')
    .select(
      '*, tipologia:rdf_type ( id, type_code, schema_org_type, grupo )',
      { count: 'exact' },
    )
    .eq('estado_editorial', 'publicado');

  if (type) query = query.eq('rdf_type', type);
  if (municipio) query = query.eq('municipio_id', municipio);

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

  let query = sb
    .from('zona')
    .select('id, slug, municipio_id')
    .order('slug');

  if (municipio) query = query.eq('municipio_id', municipio);

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
  return json(items, 200, req);
}

async function listEvents(url: URL, req: Request) {
  const sb = getAdminClient();
  const from = url.searchParams.get('from') || undefined;
  const to = url.searchParams.get('to') || undefined;

  let query = sb
    .from('recurso_turistico')
    .select('id, uri, slug, tipologia:tipo_id ( type_code ), latitude, longitude')
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
    .select('id, uri, slug, tipologia:tipo_id ( type_code ), latitude, longitude')
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
      'id, uri, slug, rdf_type, municipio_id, latitude, longitude, tipologia:rdf_type ( type_code, schema_org_type )',
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

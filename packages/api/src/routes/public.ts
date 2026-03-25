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

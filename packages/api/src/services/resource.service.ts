import { supabase } from '../db/supabase.js';
import { getTranslations } from './translation.service.js';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

interface ListParams {
  type?: string;
  municipio?: string;
  lang?: string;
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export async function listResources(params: ListParams) {
  const {
    type,
    municipio,
    status = 'publicado',
    page = 1,
    limit = 20,
    sort = 'created_at',
  } = params;

  let query = supabase
    .from('recurso_turistico')
    .select(`
      *,
      tipologia:tipo_id ( type_code, schema_org_type ),
      municipio:municipio_id ( slug, codigo_ine )
    `, { count: 'exact' })
    .eq('estado', status);

  if (type) {
    query = query.eq('tipologia.type_code', type);
  }
  if (municipio) {
    query = query.eq('municipio.slug', municipio);
  }

  const offset = (page - 1) * limit;
  query = query
    .order(sort === 'updated' ? 'updated_at' : 'created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count || 0;
  const items = await Promise.all((data || []).map(mapResourceRow));

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getResourceById(id: string) {
  const { data, error } = await supabase
    .from('recurso_turistico')
    .select(`
      *,
      tipologia:tipo_id ( type_code, schema_org_type )
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError(404, 'Resource not found');
  return mapResourceRow(data);
}

export async function getResourceBySlug(slug: string) {
  const { data, error } = await supabase
    .from('recurso_turistico')
    .select(`
      *,
      tipologia:tipo_id ( type_code, schema_org_type )
    `)
    .eq('slug', slug)
    .single();

  if (error || !data) throw new AppError(404, 'Resource not found');
  return mapResourceRow(data);
}

// ---------------------------------------------------------------------------
// Row mapper — builds full API shape from Supabase row + translations
// ---------------------------------------------------------------------------

async function mapResourceRow(row: Record<string, any>) {
  const translations = await getTranslations('recurso_turistico', row.id);
  const tipologia = row.tipologia as Record<string, string> | null;

  return {
    id: row.id,
    uri: row.uri,
    rdfType: tipologia?.type_code || null,
    schemaOrgType: tipologia?.schema_org_type || null,
    slug: row.slug,
    name: translations.name || {},
    description: translations.description || {},
    seoTitle: translations.seo_title || {},
    seoDescription: translations.seo_description || {},
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      streetAddress: row.direccion,
      postalCode: row.codigo_postal,
    },
    municipioId: row.municipio_id,
    zonaId: row.zona_id,
    contact: {
      telephone: row.telefono || [],
      email: row.email || [],
      url: row.web,
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
    status: row.estado,
    visibleOnMap: row.visible_mapa,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

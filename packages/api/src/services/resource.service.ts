import { supabase } from '../db/supabase.js';
import { getTranslations } from './translation.service.js';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Types
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

interface CreateResourceInput {
  rdf_type: string;
  slug: string;
  municipio_id?: string | null;
  zona_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address_street?: string | null;
  address_postal?: string | null;
  telephone?: string[];
  email?: string[];
  url?: string | null;
  same_as?: string[];
  tourist_types?: string[];
  rating_value?: number | null;
  serves_cuisine?: string[];
  is_accessible_for_free?: boolean | null;
  public_access?: boolean | null;
  occupancy?: number | null;
  opening_hours?: string | null;
  extras?: Record<string, unknown>;
  visible_en_mapa?: boolean;
  // Translations
  name?: Record<string, string>;
  description?: Record<string, string>;
  // Categories
  category_ids?: string[];
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listResources(params: ListParams) {
  const {
    type,
    municipio,
    status,
    page = 1,
    limit = 20,
    sort = 'created_at',
  } = params;

  let query = supabase
    .from('recurso_turistico')
    .select(`
      *,
      tipologia:rdf_type ( id, type_code, schema_org_type, grupo )
    `, { count: 'exact' });

  if (status) {
    query = query.eq('estado_editorial', status);
  }
  if (type) {
    query = query.eq('rdf_type', type);
  }
  if (municipio) {
    query = query.eq('municipio_id', municipio);
  }

  const offset = (page - 1) * limit;
  const orderCol = sort === 'updated' ? 'updated_at' : 'created_at';
  query = query
    .order(orderCol, { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count || 0;
  const items = await Promise.all((data || []).map(mapResourceRow));

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

export async function getResourceById(id: string) {
  const { data, error } = await supabase
    .from('recurso_turistico')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError(404, 'Resource not found');
  return mapResourceRow(data);
}

// ---------------------------------------------------------------------------
// Get by slug
// ---------------------------------------------------------------------------

export async function getResourceBySlug(slug: string) {
  const { data, error } = await supabase
    .from('recurso_turistico')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) throw new AppError(404, 'Resource not found');
  return mapResourceRow(data);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createResource(input: CreateResourceInput) {
  const uri = `osalnes:recurso:${input.slug}`;

  const { data, error } = await supabase
    .from('recurso_turistico')
    .insert({
      uri,
      rdf_type: input.rdf_type,
      slug: input.slug,
      municipio_id: input.municipio_id || null,
      zona_id: input.zona_id || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      address_street: input.address_street || null,
      address_postal: input.address_postal || null,
      telephone: input.telephone || [],
      email: input.email || [],
      url: input.url || null,
      same_as: input.same_as || [],
      tourist_types: input.tourist_types || [],
      rating_value: input.rating_value || null,
      serves_cuisine: input.serves_cuisine || [],
      is_accessible_for_free: input.is_accessible_for_free ?? null,
      public_access: input.public_access ?? null,
      occupancy: input.occupancy || null,
      opening_hours: input.opening_hours || null,
      extras: input.extras || {},
      visible_en_mapa: input.visible_en_mapa ?? true,
      estado_editorial: 'borrador',
    })
    .select()
    .single();

  if (error) throw new AppError(400, error.message);

  // Save translations
  if (input.name) await saveTranslations('recurso_turistico', data.id, 'name', input.name);
  if (input.description) await saveTranslations('recurso_turistico', data.id, 'description', input.description);

  // Save category associations
  if (input.category_ids?.length) {
    await supabase.from('recurso_categoria').insert(
      input.category_ids.map((cid) => ({ recurso_id: data.id, categoria_id: cid })),
    );
  }

  return mapResourceRow(data);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateResource(id: string, input: Partial<CreateResourceInput>) {
  // Build update object only with provided fields
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.rdf_type !== undefined) update.rdf_type = input.rdf_type;
  if (input.slug !== undefined) {
    update.slug = input.slug;
    update.uri = `osalnes:recurso:${input.slug}`;
  }
  if (input.municipio_id !== undefined) update.municipio_id = input.municipio_id || null;
  if (input.zona_id !== undefined) update.zona_id = input.zona_id || null;
  if (input.latitude !== undefined) update.latitude = input.latitude;
  if (input.longitude !== undefined) update.longitude = input.longitude;
  if (input.address_street !== undefined) update.address_street = input.address_street;
  if (input.address_postal !== undefined) update.address_postal = input.address_postal;
  if (input.telephone !== undefined) update.telephone = input.telephone;
  if (input.email !== undefined) update.email = input.email;
  if (input.url !== undefined) update.url = input.url;
  if (input.same_as !== undefined) update.same_as = input.same_as;
  if (input.tourist_types !== undefined) update.tourist_types = input.tourist_types;
  if (input.rating_value !== undefined) update.rating_value = input.rating_value;
  if (input.serves_cuisine !== undefined) update.serves_cuisine = input.serves_cuisine;
  if (input.is_accessible_for_free !== undefined) update.is_accessible_for_free = input.is_accessible_for_free;
  if (input.public_access !== undefined) update.public_access = input.public_access;
  if (input.occupancy !== undefined) update.occupancy = input.occupancy;
  if (input.opening_hours !== undefined) update.opening_hours = input.opening_hours;
  if (input.extras !== undefined) update.extras = input.extras;
  if (input.visible_en_mapa !== undefined) update.visible_en_mapa = input.visible_en_mapa;

  const { data, error } = await supabase
    .from('recurso_turistico')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  if (!data) throw new AppError(404, 'Resource not found');

  // Update translations
  if (input.name) await saveTranslations('recurso_turistico', id, 'name', input.name);
  if (input.description) await saveTranslations('recurso_turistico', id, 'description', input.description);

  // Update categories
  if (input.category_ids !== undefined) {
    await supabase.from('recurso_categoria').delete().eq('recurso_id', id);
    if (input.category_ids.length) {
      await supabase.from('recurso_categoria').insert(
        input.category_ids.map((cid) => ({ recurso_id: id, categoria_id: cid })),
      );
    }
  }

  return mapResourceRow(data);
}

// ---------------------------------------------------------------------------
// Update status
// ---------------------------------------------------------------------------

export async function updateResourceStatus(id: string, newStatus: string) {
  const validStates = ['borrador', 'revision', 'publicado', 'archivado'];
  if (!validStates.includes(newStatus)) {
    throw new AppError(400, `Invalid status: ${newStatus}`);
  }

  const update: Record<string, unknown> = {
    estado_editorial: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'publicado') {
    update.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('recurso_turistico')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  if (!data) throw new AppError(404, 'Resource not found');

  return mapResourceRow(data);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteResource(id: string) {
  // Translations and categories cascade via FK
  const { error } = await supabase
    .from('recurso_turistico')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(400, error.message);
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function saveTranslations(
  entidadTipo: string,
  entidadId: string,
  campo: string,
  values: Record<string, string>,
) {
  for (const [idioma, valor] of Object.entries(values)) {
    if (!valor) continue;
    await supabase
      .from('traduccion')
      .upsert(
        { entidad_tipo: entidadTipo, entidad_id: entidadId, campo, idioma, valor },
        { onConflict: 'entidad_tipo,entidad_id,campo,idioma' },
      );
  }
}

async function mapResourceRow(row: Record<string, any>) {
  const translations = await getTranslations('recurso_turistico', row.id);

  // Load categories
  const { data: cats } = await supabase
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
    categoryIds: (cats || []).map((c: any) => c.categoria_id),
  };
}

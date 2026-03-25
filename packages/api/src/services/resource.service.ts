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
  seo_title?: Record<string, string>;
  seo_description?: Record<string, string>;
  // Categories
  category_ids?: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Sanitize Supabase error messages — hide internal DB details from clients */
function sanitizeDbError(msg: string): string {
  if (msg.includes('duplicate key') && msg.includes('slug')) return 'Ya existe un recurso con ese slug';
  if (msg.includes('duplicate key') && msg.includes('uri')) return 'Ya existe un recurso con esa URI';
  if (msg.includes('duplicate key')) return 'Ya existe un registro duplicado';
  if (msg.includes('violates foreign key')) return 'Referencia a un registro que no existe';
  if (msg.includes('violates check constraint')) return 'Valor fuera de rango permitido';
  return 'Error al guardar en la base de datos';
}

function validateResourceInput(input: Partial<CreateResourceInput>, isCreate = false) {
  const errors: string[] = [];

  if (isCreate) {
    if (!input.rdf_type) errors.push('rdf_type es obligatorio');
    if (!input.slug) errors.push('slug es obligatorio');
    if (!input.name?.es) errors.push('name.es es obligatorio');
  }

  if (input.slug !== undefined) {
    if (!SLUG_RE.test(input.slug)) errors.push('slug debe contener solo letras minusculas, numeros y guiones');
    if (input.slug.length > 300) errors.push('slug demasiado largo (max 300 caracteres)');
  }

  if (input.latitude !== undefined && input.latitude !== null) {
    if (input.latitude < -90 || input.latitude > 90) errors.push('latitude debe estar entre -90 y 90');
  }
  if (input.longitude !== undefined && input.longitude !== null) {
    if (input.longitude < -180 || input.longitude > 180) errors.push('longitude debe estar entre -180 y 180');
  }

  if (input.email?.length) {
    for (const e of input.email) {
      if (!EMAIL_RE.test(e)) errors.push(`email invalido: ${e}`);
    }
  }

  if (input.url && !URL_RE.test(input.url)) {
    errors.push('url debe comenzar con http:// o https://');
  }

  if (input.same_as?.length) {
    for (const u of input.same_as) {
      if (!URL_RE.test(u)) errors.push(`same_as invalido: ${u}`);
    }
  }

  if (input.rating_value !== undefined && input.rating_value !== null) {
    if (input.rating_value < 1 || input.rating_value > 6) errors.push('rating_value debe estar entre 1 y 6');
  }

  if (input.occupancy !== undefined && input.occupancy !== null) {
    if (input.occupancy < 0) errors.push('occupancy no puede ser negativo');
  }

  if (input.seo_description) {
    for (const [lang, val] of Object.entries(input.seo_description)) {
      if (val.length > 300) errors.push(`seo_description.${lang} demasiado larga (max 300 caracteres)`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(400, errors.join('; '));
  }
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
  validateResourceInput(input, true);

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

  if (error) throw new AppError(400, sanitizeDbError(error.message));

  // Save translations and categories — rollback resource if any fails
  try {
    if (input.name) await saveTranslations('recurso_turistico', data.id, 'name', input.name);
    if (input.description) await saveTranslations('recurso_turistico', data.id, 'description', input.description);
    if (input.seo_title) await saveTranslations('recurso_turistico', data.id, 'seo_title', input.seo_title);
    if (input.seo_description) await saveTranslations('recurso_turistico', data.id, 'seo_description', input.seo_description);

    if (input.category_ids?.length) {
      const { error: catError } = await supabase.from('recurso_categoria').insert(
        input.category_ids.map((cid) => ({ recurso_id: data.id, categoria_id: cid })),
      );
      if (catError) throw catError;
    }
  } catch (err) {
    // Rollback: delete the resource we just created
    await supabase.from('recurso_turistico').delete().eq('id', data.id);
    throw new AppError(400, `Error guardando datos asociados: ${err instanceof Error ? err.message : String(err)}`);
  }

  return mapResourceRow(data);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateResource(id: string, input: Partial<CreateResourceInput>) {
  validateResourceInput(input);

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

  if (error) throw new AppError(400, sanitizeDbError(error.message));
  if (!data) throw new AppError(404, 'Resource not found');

  // Update translations
  if (input.name) await saveTranslations('recurso_turistico', id, 'name', input.name);
  if (input.description) await saveTranslations('recurso_turistico', id, 'description', input.description);
  if (input.seo_title) await saveTranslations('recurso_turistico', id, 'seo_title', input.seo_title);
  if (input.seo_description) await saveTranslations('recurso_turistico', id, 'seo_description', input.seo_description);

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

// Transiciones de estado permitidas (BRI-6.1)
const STATE_TRANSITIONS: Record<string, string[]> = {
  borrador: ['revision', 'archivado'],
  revision: ['publicado', 'borrador'],
  publicado: ['archivado', 'borrador'],
  archivado: ['borrador'],
};

export async function updateResourceStatus(id: string, newStatus: string) {
  const validStates = ['borrador', 'revision', 'publicado', 'archivado'];
  if (!validStates.includes(newStatus)) {
    throw new AppError(400, `Estado invalido: ${newStatus}`);
  }

  // Get current status
  const { data: current, error: fetchError } = await supabase
    .from('recurso_turistico')
    .select('estado_editorial')
    .eq('id', id)
    .single();

  if (fetchError || !current) throw new AppError(404, 'Recurso no encontrado');

  const currentStatus = current.estado_editorial;
  const allowed = STATE_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new AppError(400, `Transicion no permitida: ${currentStatus} → ${newStatus}. Permitidas: ${allowed.join(', ')}`);
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

  if (error) throw new AppError(400, sanitizeDbError(error.message));
  if (!data) throw new AppError(404, 'Recurso no encontrado');

  return mapResourceRow(data);
}

/** Get allowed transitions for a given status */
export function getAllowedTransitions(status: string): string[] {
  return STATE_TRANSITIONS[status] || [];
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

  if (error) throw new AppError(400, sanitizeDbError(error.message));
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

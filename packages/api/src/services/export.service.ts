import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Schema.org mapping (UNE 178503)
// ---------------------------------------------------------------------------

const SCHEMA_ORG_MAP: Record<string, string> = {
  Hotel: 'Hotel', RuralHouse: 'House', BedAndBreakfast: 'BedAndBreakfast',
  Campground: 'Campground', Apartment: 'Apartment', Hostel: 'Hostel',
  Restaurant: 'Restaurant', BarOrPub: 'BarOrPub', CafeOrCoffeeShop: 'CafeOrCoffeeShop',
  Winery: 'Winery', TouristAttraction: 'TouristAttraction', Beach: 'Beach',
  Museum: 'Museum', Park: 'Park', ViewPoint: 'Place',
  PlaceOfWorship: 'PlaceOfWorship', Event: 'Event', Festival: 'Festival',
  MusicEvent: 'MusicEvent', TouristDestination: 'TouristDestination',
};

// ---------------------------------------------------------------------------
// Create export job
// ---------------------------------------------------------------------------

export async function createExportJob(
  tipo: 'pid' | 'datalake' | 'csv' | 'json',
  parametros: Record<string, unknown> = {},
  userId?: string,
) {
  const { data, error } = await supabase
    .from('export_job')
    .insert({
      tipo,
      estado: 'pendiente',
      parametros,
      created_by: userId || null,
    })
    .select()
    .single();

  if (error) throw new AppError(400, error.message);

  // Launch async processing (fire-and-forget)
  processExportJob(data.id, tipo).catch((err) =>
    console.error(`[export] Job ${data.id} failed:`, err),
  );

  return data;
}

// ---------------------------------------------------------------------------
// Get job status
// ---------------------------------------------------------------------------

export async function getExportJob(jobId: string) {
  const { data, error } = await supabase
    .from('export_job')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) throw new AppError(404, 'Export job not found');
  return data;
}

// ---------------------------------------------------------------------------
// List jobs
// ---------------------------------------------------------------------------

export async function listExportJobs(tipo?: string) {
  let query = supabase
    .from('export_job')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Process job (async background)
// ---------------------------------------------------------------------------

async function processExportJob(jobId: string, tipo: string) {
  // Mark as in progress
  await supabase
    .from('export_job')
    .update({ estado: 'en_proceso', started_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    // Fetch all published resources
    const { data: resources, error } = await supabase
      .from('recurso_turistico')
      .select(`
        id, uri, rdf_type, slug, latitude, longitude,
        address_street, address_postal, telephone, email, url,
        tourist_types, rating_value, serves_cuisine, opening_hours,
        is_accessible_for_free, public_access, occupancy,
        extras, municipio_id, published_at, created_at, updated_at
      `)
      .eq('estado_editorial', 'publicado')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const rows = resources || [];
    const total = rows.length;

    // Batch-fetch all translations (fix N+1)
    const ids = rows.map((r) => r.id);
    const tMap: Record<string, Record<string, Record<string, string>>> = {};

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

    // Fetch municipality names
    const muniIds = [...new Set(rows.map((r) => r.municipio_id).filter(Boolean))];
    const muniMap: Record<string, string> = {};
    if (muniIds.length > 0) {
      const { data: munis } = await supabase.from('municipio').select('id, slug').in('id', muniIds);
      for (const m of munis || []) { muniMap[m.id] = m.slug; }
    }

    let ok = 0;
    let errors = 0;
    const results: Record<string, unknown>[] = [];

    for (const row of rows) {
      try {
        const names = tMap[row.id]?.name || {};
        const descs = tMap[row.id]?.description || {};

        if (tipo === 'pid') {
          const schemaType = SCHEMA_ORG_MAP[row.rdf_type] || 'TouristAttraction';
          const item: Record<string, unknown> = {
            '@context': 'https://schema.org',
            '@type': schemaType,
            '@id': `https://turismo.osalnes.gal/es/recurso/${row.slug}`,
            identifier: row.uri,
            url: `https://turismo.osalnes.gal/es/recurso/${row.slug}`,
          };

          if (names.es) item.name = names.es;
          else if (names.gl) item.name = names.gl;
          if (descs.es) item.description = descs.es;
          else if (descs.gl) item.description = descs.gl;

          if (row.latitude && row.longitude) {
            item.geo = { '@type': 'GeoCoordinates', latitude: Number(row.latitude), longitude: Number(row.longitude) };
          }
          if (row.address_street || row.address_postal) {
            item.address = {
              '@type': 'PostalAddress',
              ...(row.address_street && { streetAddress: row.address_street }),
              ...(row.address_postal && { postalCode: row.address_postal }),
              ...(row.municipio_id && muniMap[row.municipio_id] && { addressLocality: muniMap[row.municipio_id] }),
              addressRegion: 'Pontevedra',
              addressCountry: 'ES',
            };
          }
          if (row.telephone?.length) item.telephone = row.telephone;
          if (row.email?.length) item.email = row.email;
          if (row.url) item.sameAs = row.url;
          if (row.rating_value) item.starRating = { '@type': 'Rating', ratingValue: row.rating_value };
          if (row.tourist_types?.length) item.touristType = row.tourist_types;
          if (row.serves_cuisine?.length) item.servesCuisine = row.serves_cuisine;
          if (row.opening_hours) item.openingHours = row.opening_hours;
          if (row.is_accessible_for_free !== null) item.isAccessibleForFree = row.is_accessible_for_free;
          if (row.published_at) item.datePublished = row.published_at;
          if (row.updated_at) item.dateModified = row.updated_at;

          results.push(item);
        } else {
          // datalake / csv / json — flat format
          results.push({
            id: row.id, uri: row.uri, type: row.rdf_type, slug: row.slug,
            name: names, description: descs,
            latitude: row.latitude, longitude: row.longitude,
            address_street: row.address_street, address_postal: row.address_postal,
            municipio: muniMap[row.municipio_id] || row.municipio_id,
            telephone: row.telephone, email: row.email, url: row.url,
            tourist_types: row.tourist_types, rating_value: row.rating_value,
            serves_cuisine: row.serves_cuisine, opening_hours: row.opening_hours,
            created_at: row.created_at, updated_at: row.updated_at,
          });
        }
        ok++;
      } catch {
        errors++;
      }
    }

    // Mark as completed with results
    await supabase
      .from('export_job')
      .update({
        estado: 'completado',
        completed_at: new Date().toISOString(),
        total_registros: total,
        registros_ok: ok,
        registros_err: errors,
        resultado: tipo === 'pid'
          ? { '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: ok, itemListElement: results }
          : { format: tipo, count: ok, data: results },
      })
      .eq('id', jobId);
  } catch (err) {
    await supabase
      .from('export_job')
      .update({
        estado: 'error',
        completed_at: new Date().toISOString(),
        resultado: { error: String(err) },
      })
      .eq('id', jobId);
  }
}

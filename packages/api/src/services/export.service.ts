import { supabase } from '../db/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { getTranslations } from './translation.service.js';

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

  // Launch async processing
  processExportJob(data.id, tipo, parametros).catch((err) =>
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

async function processExportJob(
  jobId: string,
  tipo: string,
  parametros: Record<string, unknown>,
) {
  // Mark as in progress
  await supabase
    .from('export_job')
    .update({ estado: 'en_proceso', iniciado_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    // Fetch all published resources
    const { data: resources, error } = await supabase
      .from('recurso_turistico')
      .select(`
        id, uri, rdf_type, slug, latitude, longitude,
        address_street, address_postal, telephone, email, url,
        tourist_types, rating_value, serves_cuisine, opening_hours,
        extras, municipio_id, created_at, updated_at
      `)
      .eq('estado_editorial', 'publicado')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total = resources?.length || 0;
    let ok = 0;
    let errors = 0;

    const results: Record<string, unknown>[] = [];

    for (const row of resources || []) {
      try {
        const translations = await getTranslations('recurso_turistico', row.id);

        if (tipo === 'pid') {
          // PID SEGITTUR format
          results.push({
            '@context': 'https://schema.org',
            '@type': row.rdf_type,
            uri: row.uri,
            name: translations.name || {},
            description: translations.description || {},
            geo: row.latitude && row.longitude
              ? { '@type': 'GeoCoordinates', latitude: row.latitude, longitude: row.longitude }
              : null,
            address: {
              '@type': 'PostalAddress',
              streetAddress: row.address_street,
              postalCode: row.address_postal,
              addressRegion: 'Pontevedra',
              addressCountry: 'ES',
            },
            telephone: row.telephone,
            email: row.email,
            url: row.url,
          });
        } else {
          // datalake / csv / json — flat format
          results.push({
            id: row.id,
            uri: row.uri,
            type: row.rdf_type,
            slug: row.slug,
            name: translations.name || {},
            description: translations.description || {},
            latitude: row.latitude,
            longitude: row.longitude,
            address_street: row.address_street,
            address_postal: row.address_postal,
            telephone: row.telephone,
            email: row.email,
            url: row.url,
            tourist_types: row.tourist_types,
            rating_value: row.rating_value,
            serves_cuisine: row.serves_cuisine,
            opening_hours: row.opening_hours,
            municipio_id: row.municipio_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
          });
        }
        ok++;
      } catch {
        errors++;
      }
    }

    // Mark as completed
    await supabase
      .from('export_job')
      .update({
        estado: 'completado',
        finalizado_at: new Date().toISOString(),
        total_registros: total,
        registros_ok: ok,
        registros_error: errors,
        resultado: { data: results },
      })
      .eq('id', jobId);
  } catch (err) {
    await supabase
      .from('export_job')
      .update({
        estado: 'error',
        finalizado_at: new Date().toISOString(),
        resultado: { error: String(err) },
      })
      .eq('id', jobId);
  }
}

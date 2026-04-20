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
        extras, municipio_id, published_at, created_at, updated_at,
        street_address, postal_code, locality, parroquia_text,
        contact_phone, contact_email, contact_web,
        social_links, opening_hours_plan
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
          // Paso 3 · t5 — prioridad a los campos estructurados de la
          // migración 021 con fallback a los legacy mientras convivan.
          const streetAddr = row.street_address ?? row.address_street;
          const postal = row.postal_code ?? row.address_postal;
          const addressLocality = row.locality ?? (row.municipio_id ? muniMap[row.municipio_id] : undefined);
          if (streetAddr || postal || addressLocality) {
            item.address = {
              '@type': 'PostalAddress',
              ...(streetAddr && { streetAddress: streetAddr }),
              ...(postal && { postalCode: postal }),
              ...(addressLocality && { addressLocality }),
              ...(row.parroquia_text && { addressSubregion: row.parroquia_text }),
              addressRegion: 'Pontevedra',
              addressCountry: 'ES',
            };
          }
          // contact_* (single-string) tiene prioridad sobre legacy arrays.
          const telephones: string[] = row.contact_phone
            ? [row.contact_phone]
            : (row.telephone ?? []);
          const emails: string[] = row.contact_email
            ? [row.contact_email]
            : (row.email ?? []);
          const web = row.contact_web ?? row.url;
          if (telephones.length) item.telephone = telephones;
          if (emails.length) item.email = emails;
          if (web) item.url = web;
          // sameAs schema.org = URLs externas (redes sociales + web del legacy).
          const sameAs = Array.isArray(row.social_links)
            ? row.social_links
                .map((l: { url?: string } | null) => l?.url)
                .filter((u): u is string => typeof u === 'string' && !!u)
            : [];
          if (sameAs.length) item.sameAs = sameAs;
          else if (row.url) item.sameAs = row.url;
          if (row.rating_value) item.starRating = { '@type': 'Rating', ratingValue: row.rating_value };
          if (row.tourist_types?.length) item.touristType = row.tourist_types;
          if (row.serves_cuisine?.length) item.servesCuisine = row.serves_cuisine;
          // Horarios estructurados (opening_hours_plan) tienen prioridad;
          // si no hay plan, se cae al textarea legacy opening_hours.
          const hoursPid = mapOpeningHoursPlanToPid(row.opening_hours_plan);
          if (hoursPid.hasOpeningHours) item.hasOpeningHours = hoursPid.hasOpeningHours;
          if (hoursPid.specialOpeningHoursSpecification) {
            item.specialOpeningHoursSpecification = hoursPid.specialOpeningHoursSpecification;
          }
          if (!item.hasOpeningHours && row.opening_hours) {
            item.openingHours = row.opening_hours;
          }
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

// ─────────────────────────────────────────────────────────────────────────
// Paso 3 · t5 — Mapeo de opening_hours_plan (JSONB) a schema.org
// OpeningHoursSpecification. Ver packages/shared/src/data/opening-hours.ts
// para el shape completo.
// ─────────────────────────────────────────────────────────────────────────

const DAY_URL: Record<string, string> = {
  Mo: 'https://schema.org/Monday',
  Tu: 'https://schema.org/Tuesday',
  We: 'https://schema.org/Wednesday',
  Th: 'https://schema.org/Thursday',
  Fr: 'https://schema.org/Friday',
  Sa: 'https://schema.org/Saturday',
  Su: 'https://schema.org/Sunday',
};

interface OpeningHoursPayload {
  hasOpeningHours?: unknown;
  specialOpeningHoursSpecification?: unknown[];
}

/**
 * Mapea las 7 plantillas del selector al formato schema.org. Los casos
 * más complejos (appointment/external/closed) se publican como nota
 * textual en lugar de inventar un subtipo que no existe en schema.org.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOpeningHoursPlanToPid(plan: any): OpeningHoursPayload {
  if (!plan || typeof plan !== 'object') return {};
  const out: OpeningHoursPayload = {};

  switch (plan.kind) {
    case 'always':
      out.hasOpeningHours = {
        '@type': 'OpeningHoursSpecification',
        opens: '00:00',
        closes: '23:59',
        dayOfWeek: Object.values(DAY_URL),
      };
      break;

    case 'weekly': {
      const specs: unknown[] = [];
      for (const d of plan.days ?? []) {
        const dayUrl = DAY_URL[d.day];
        if (!dayUrl) continue;
        for (const r of d.ranges ?? []) {
          if (!r?.opensAt || !r?.closesAt) continue;
          specs.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: dayUrl,
            opens: r.opensAt,
            closes: r.closesAt,
          });
        }
      }
      if (specs.length) out.hasOpeningHours = specs;
      break;
    }

    case 'seasonal': {
      const specs: unknown[] = [];
      for (const p of plan.periods ?? []) {
        specs.push({
          '@type': 'OpeningHoursSpecification',
          ...(p.validFrom && { validFrom: p.validFrom }),
          ...(p.validThrough && { validThrough: p.validThrough }),
          ...(p.note && { description: p.note }),
        });
      }
      if (specs.length) out.hasOpeningHours = specs;
      break;
    }

    case 'event':
      if (plan.startDate || plan.endDate) {
        out.hasOpeningHours = {
          '@type': 'OpeningHoursSpecification',
          ...(plan.startDate && { validFrom: plan.startDate }),
          ...(plan.endDate && { validThrough: plan.endDate }),
          ...(plan.opensAt && { opens: plan.opensAt }),
          ...(plan.closesAt && { closes: plan.closesAt }),
        };
      }
      break;

    case 'appointment':
    case 'external':
    case 'closed':
      // Sin subtipo directo de schema.org — se publica como nota textual
      // adjunta a la ficha (el consumidor PID lo lee como "descripción
      // adicional de horario").
      if (plan.note) {
        out.hasOpeningHours = { '@type': 'OpeningHoursSpecification', description: plan.note };
      }
      break;
  }

  // Cierres puntuales (vacaciones, obras…) se listan siempre aparte.
  if (Array.isArray(plan.closures) && plan.closures.length) {
    out.specialOpeningHoursSpecification = plan.closures.map((c: { from?: string; to?: string; note?: string }) => ({
      '@type': 'OpeningHoursSpecification',
      ...(c.from && { validFrom: c.from }),
      ...(c.to && { validThrough: c.to }),
      ...(c.note && { description: c.note }),
      opens: '00:00',
      closes: '00:00',
    }));
  }

  return out;
}

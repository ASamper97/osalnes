// ===========================================================================
// export-worker · Edge Function Supabase
// ===========================================================================
//
// Worker asíncrono que procesa jobs de exportación. Se invoca tras crear
// un job desde el RPC `exports_launch`.
//
// REESCRITO (SCR-13 · A2, 2026-04-23) contra el esquema real:
//   · Tabla `recurso_turistico` (no `resources`)
//   · Tabla `municipio` (no `municipalities`)
//   · estado_editorial (no publication_status) con valor 'publicado'
//   · rdf_type (no single_type_vocabulary)
//   · municipio_id (no municipality_id)
//   · name/description vía tr_get (no columnas name_es/description_es)
//   · Campos duplicados contact_*/telephone[]/email[]/url sobreviven
//     ambos con coalesce(new, old)
//
// Dos modos de invocación soportados:
//   1) HTTP POST { job_id } → procesa ese job específico
//   2) HTTP POST (sin body) → busca todos los jobs 'pending' y los procesa
//
// Cuando se conecte al PID real, sustituir la función `sendToEndpoint`
// por la llamada real (fetch al endpoint del PID con auth).
//
// Desplegar con:
//   npx supabase functions deploy export-worker
//
// Invocar tras crear un job (desde el frontend):
//   await supabase.functions.invoke('export-worker', { body: { job_id } })
//
// O programar desde pg_cron si se quiere auto-procesamiento:
//   select cron.schedule('exports_worker_tick', '* * * * *',
//     'select net.http_post(url := ''.../functions/v1/export-worker'')');
// ===========================================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ─── Tipos internos ────────────────────────────────────────────────────

interface ExportJob {
  id: string;
  job_type: 'pid' | 'data_lake' | 'csv' | 'json_ld';
  status: string;
  scope_type: string;
  scope_ids: string[];
  records_total: number;
  started_at: string;
  triggered_by: string | null;
}

/**
 * Fila hidratada de un recurso para el worker. Los nombres mantienen el
 * estilo camelCase y reflejan el modelo lógico (nameEs/descriptionEs),
 * aunque la BD resuelve nameEs/descriptionEs vía `tr_get` (no hay
 * columnas name_es/description_es reales).
 */
interface ResourceRow {
  id: string;
  slug: string;
  rdfType: string | null;
  estadoEditorial: string;
  municipioId: string | null;
  municipioName: string | null;
  nameEs: string | null;
  nameGl: string | null;
  descriptionEs: string | null;
  latitude: number | null;
  longitude: number | null;
  streetAddress: string | null;
  postalCode: string | null;
  telephone: string | null;
  email: string | null;
  web: string | null;
  pidMissingRequired: number;
}

interface ProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

// ─── Clasificación de errores (decisión 5-A) ───────────────────────────

type ErrorCategory = 'content' | 'integration' | 'schema' | 'permissions';

interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
}

type SupabaseClient = ReturnType<typeof createClient>;

// ─── Hidratación de un recurso (Spanish schema → ResourceRow) ──────────
//
// Hace las consultas necesarias para llenar el ResourceRow:
//   1) Una fila base de recurso_turistico + slug del municipio
//   2) 4 tr_get en paralelo (nameEs, nameGl, descEs, municipioName)
//   3) 1 count_pid_missing_required
//
// Es N+1 para el worker, pero como procesa asíncrono y el alcance
// suele ser <500 recursos/job, no compensa optimizar con una RPC
// dedicada. Si en fase B se ve lento, crear `exports_load_scope_row`.

async function hydrateResource(
  id: string,
  supabase: SupabaseClient,
): Promise<{ row: ResourceRow | null; error?: string }> {
  const { data: base, error } = await supabase
    .from('recurso_turistico')
    .select(`
      id, slug, rdf_type, estado_editorial, municipio_id,
      latitude, longitude,
      address_street, address_postal,
      street_address, postal_code,
      telephone, email, url,
      contact_phone, contact_email, contact_web,
      municipio:municipio_id ( slug )
    `)
    .eq('id', id)
    .single();

  if (error || !base) {
    return { row: null, error: error?.message ?? 'Recurso no encontrado' };
  }

  const b = base as Record<string, unknown>;
  const municipioRel = b.municipio as { slug?: string } | null;

  // Paralelo: traducciones + pid_missing_required
  const [nameEsRes, nameGlRes, descEsRes, municipioNameRes, pidMissingRes] = await Promise.all([
    supabase.rpc('tr_get', {
      p_entidad_tipo: 'recurso_turistico',
      p_entidad_id: id,
      p_campo: 'name',
      p_idioma: 'es',
    }),
    supabase.rpc('tr_get', {
      p_entidad_tipo: 'recurso_turistico',
      p_entidad_id: id,
      p_campo: 'name',
      p_idioma: 'gl',
    }),
    supabase.rpc('tr_get', {
      p_entidad_tipo: 'recurso_turistico',
      p_entidad_id: id,
      p_campo: 'description',
      p_idioma: 'es',
    }),
    b.municipio_id
      ? supabase.rpc('tr_get', {
          p_entidad_tipo: 'municipio',
          p_entidad_id: b.municipio_id,
          p_campo: 'name',
          p_idioma: 'es',
        })
      : Promise.resolve({ data: null, error: null }),
    supabase.rpc('count_pid_missing_required', { p_resource_id: id }),
  ]);

  const nameEs = (nameEsRes.data as string | null) ?? null;
  const nameGl = (nameGlRes.data as string | null) ?? null;
  const descriptionEs = (descEsRes.data as string | null) ?? null;
  const municipioName =
    ((municipioNameRes.data as string | null) ?? null) || municipioRel?.slug || null;

  // Campos duplicados: preferir nuevo, fallback al viejo. telephone/email
  // antiguos son arrays; cogemos el primer elemento.
  const telephoneArray = Array.isArray(b.telephone) ? (b.telephone as string[]) : [];
  const emailArray = Array.isArray(b.email) ? (b.email as string[]) : [];
  const telephone = (b.contact_phone as string | null) ?? telephoneArray[0] ?? null;
  const email = (b.contact_email as string | null) ?? emailArray[0] ?? null;
  const web = (b.contact_web as string | null) ?? (b.url as string | null) ?? null;
  const streetAddress =
    (b.street_address as string | null) ?? (b.address_street as string | null) ?? null;
  const postalCode =
    (b.postal_code as string | null) ?? (b.address_postal as string | null) ?? null;

  const row: ResourceRow = {
    id: String(b.id),
    slug: String(b.slug ?? ''),
    rdfType: (b.rdf_type as string | null) ?? null,
    estadoEditorial: String(b.estado_editorial ?? 'borrador'),
    municipioId: (b.municipio_id as string | null) ?? null,
    municipioName,
    nameEs,
    nameGl,
    descriptionEs,
    latitude: (b.latitude as number | null) ?? null,
    longitude: (b.longitude as number | null) ?? null,
    streetAddress,
    postalCode,
    telephone,
    email,
    web,
    pidMissingRequired: Number(pidMissingRes.data ?? 0),
  };

  return { row };
}

// ─── Generación de payload por job_type (decisión 2-B) ─────────────────

async function buildPayload(
  resource: ResourceRow,
  jobType: string,
  supabase: SupabaseClient,
): Promise<{ payload: unknown; error?: ClassifiedError }> {
  // Validación previa de contenido obligatorio
  if (resource.pidMissingRequired > 0) {
    return {
      payload: null,
      error: {
        category: 'content',
        message: `Faltan ${resource.pidMissingRequired} campos obligatorios PID sin rellenar`,
        details: { missing_count: resource.pidMissingRequired },
      },
    };
  }

  if (jobType === 'pid' || jobType === 'json_ld') {
    // JSON-LD schema.org (UNE 178503)
    const base: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': resource.rdfType ?? 'TouristAttraction',
      '@id': `https://turismo.osalnes.gal/es/recurso/${resource.slug}`,
      name: resource.nameEs ?? resource.nameGl ?? resource.slug,
    };
    if (resource.nameGl && resource.nameGl !== resource.nameEs) base.alternateName = resource.nameGl;
    if (resource.descriptionEs) base.description = resource.descriptionEs;
    if (resource.streetAddress) base.streetAddress = resource.streetAddress;
    if (resource.postalCode) base.postalCode = resource.postalCode;
    if (resource.municipioName) base.addressLocality = resource.municipioName;
    if (resource.latitude != null && resource.longitude != null) {
      base.geo = {
        '@type': 'GeoCoordinates',
        latitude: resource.latitude,
        longitude: resource.longitude,
      };
    }
    if (resource.telephone) base.telephone = resource.telephone;
    if (resource.email) base.email = resource.email;
    if (resource.web) base.url = resource.web;

    // Añadir relaciones (RPC del paso 8)
    try {
      const { data: relData } = await supabase.rpc('generate_jsonld_relations', {
        p_resource_id: resource.id,
      });
      if (relData && typeof relData === 'object') {
        Object.assign(base, relData);
      }
    } catch {
      // paso 8 no instalado, continuar sin relaciones
    }

    return { payload: base };
  }

  if (jobType === 'data_lake') {
    // Formato Data Lake: JSON plano, menos estructurado, más completo
    return {
      payload: {
        id: resource.id,
        slug: resource.slug,
        nameEs: resource.nameEs,
        nameGl: resource.nameGl,
        description: resource.descriptionEs,
        type: resource.rdfType,
        municipalityId: resource.municipioId,
        municipalityName: resource.municipioName,
        latitude: resource.latitude,
        longitude: resource.longitude,
        address: {
          street: resource.streetAddress,
          postalCode: resource.postalCode,
        },
        contact: {
          phone: resource.telephone,
          email: resource.email,
          web: resource.web,
        },
        publicationStatus: resource.estadoEditorial,
      },
    };
  }

  if (jobType === 'csv') {
    // Para CSV el "payload" es una fila plana que se agrega al archivo final
    return {
      payload: {
        id: resource.id,
        slug: resource.slug,
        name: resource.nameEs ?? resource.nameGl ?? '',
        type: resource.rdfType ?? '',
        municipality: resource.municipioName ?? '',
        latitude: resource.latitude ?? '',
        longitude: resource.longitude ?? '',
        status: resource.estadoEditorial,
      },
    };
  }

  return {
    payload: null,
    error: {
      category: 'schema',
      message: `Tipo de exportación desconocido: ${jobType}`,
    },
  };
}

// ─── Envío al endpoint destino ─────────────────────────────────────────
//
// En v1 simula éxito. Cuando haya credenciales del PID reales, sustituir
// esta función por un fetch al endpoint.

async function sendToEndpoint(
  _jobType: string,
  payload: unknown,
): Promise<{ ok: boolean; error?: ClassifiedError; response?: unknown }> {
  // SIMULACIÓN v1: siempre éxito (salvo errores de payload detectados antes)
  if (payload == null) {
    return {
      ok: false,
      error: {
        category: 'schema',
        message: 'Payload nulo, no se puede enviar',
      },
    };
  }

  // TODO: conexión real al PID cuando estén las credenciales
  // const pidUrl = Deno.env.get('PID_ENDPOINT_URL');
  // const pidKey = Deno.env.get('PID_API_KEY');
  // const res = await fetch(pidUrl, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pidKey}` },
  //   body: JSON.stringify(payload),
  // });
  // if (!res.ok) {
  //   return {
  //     ok: false,
  //     error: {
  //       category: 'integration',
  //       message: `PID rechazó el payload (HTTP ${res.status})`,
  //       details: { http_status: res.status, response_text: await res.text() },
  //     },
  //   };
  // }
  // return { ok: true, response: await res.json() };

  // Simulación: pequeño delay artificial para realismo
  await new Promise((r) => setTimeout(r, 15));

  return {
    ok: true,
    response: {
      simulated: true,
      acknowledged: true,
      receivedAt: new Date().toISOString(),
    },
  };
}

// ─── Procesamiento de un job ───────────────────────────────────────────

async function processJob(
  job: ExportJob,
  supabase: SupabaseClient,
): Promise<ProcessResult> {
  const startTime = Date.now();
  const result: ProcessResult = { processed: 0, failed: 0, skipped: 0 };

  // Marcar running
  await supabase
    .from('export_jobs')
    .update({ status: 'running' })
    .eq('id', job.id);

  // Hidratar cada recurso del alcance secuencialmente. Es lento si hay
  // >100 recursos; para fase B se puede crear un RPC `exports_load_scope`
  // que devuelva todas las filas hidratadas en una sola roundtrip.
  for (const resourceId of job.scope_ids ?? []) {
    const { row, error: hydrateErr } = await hydrateResource(resourceId, supabase);

    if (!row) {
      // No se pudo cargar el recurso (fue borrado entre el launch y
      // el processing, o falló el JOIN). Lo registramos como skipped.
      await supabase.from('export_job_records').insert({
        job_id: job.id,
        resource_id: resourceId,
        resource_name: null,
        resource_slug: null,
        status: 'skipped',
        error_category: 'schema',
        error_message: hydrateErr ?? 'No se pudo cargar el recurso',
      });
      result.skipped++;
      continue;
    }

    await processResource(job, row, supabase, result);
  }

  // Finalizar job con estado derivado
  const finalStatus =
    result.failed === 0 ? 'success' :
    result.processed === 0 ? 'failed' :
    'partial';

  await supabase
    .from('export_jobs')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      records_processed: result.processed,
      records_failed: result.failed,
      records_skipped: result.skipped,
    })
    .eq('id', job.id);

  return result;
}

async function processResource(
  job: ExportJob,
  resource: ResourceRow,
  supabase: SupabaseClient,
  result: ProcessResult,
): Promise<void> {
  const resourceName = resource.nameEs ?? resource.nameGl ?? resource.slug;

  // 1) Construir payload
  const { payload, error: buildError } = await buildPayload(resource, job.job_type, supabase);

  if (buildError) {
    await supabase.from('export_job_records').insert({
      job_id: job.id,
      resource_id: resource.id,
      resource_name: resourceName,
      resource_slug: resource.slug,
      status: 'failed',
      error_category: buildError.category,
      error_message: buildError.message,
      error_details: buildError.details ?? null,
    });
    result.failed++;
    return;
  }

  // 2) Enviar al endpoint destino
  const sendRes = await sendToEndpoint(job.job_type, payload);

  if (!sendRes.ok) {
    await supabase.from('export_job_records').insert({
      job_id: job.id,
      resource_id: resource.id,
      resource_name: resourceName,
      resource_slug: resource.slug,
      status: 'failed',
      error_category: sendRes.error?.category ?? 'integration',
      error_message: sendRes.error?.message ?? 'Error desconocido',
      error_details: sendRes.error?.details ?? null,
      payload,
    });
    result.failed++;
    return;
  }

  // 3) Éxito
  await supabase.from('export_job_records').insert({
    job_id: job.id,
    resource_id: resource.id,
    resource_name: resourceName,
    resource_slug: resource.slug,
    status: 'success',
    payload,
  });
  result.processed++;
}

// ─── Handler HTTP principal ────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Supabase admin client (usa service_role para procesar)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  let body: { job_id?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // body vacío, procesar todos los pending
  }

  try {
    if (body.job_id) {
      // Procesar un job específico
      const { data: job, error } = await supabase
        .from('export_jobs')
        .select('*')
        .eq('id', body.job_id)
        .eq('status', 'pending')
        .single();

      if (error || !job) {
        return new Response(
          JSON.stringify({ ok: false, error: `Job ${body.job_id} no está pendiente` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const processResult = await processJob(job as ExportJob, supabase);
      return new Response(
        JSON.stringify({ ok: true, job_id: body.job_id, result: processResult }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
      );
    }

    // Procesar todos los pending (hasta 5 por tick para no saturar)
    const { data: pendingJobs } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('started_at', { ascending: true })
      .limit(5);

    const results = [];
    for (const job of (pendingJobs ?? []) as ExportJob[]) {
      results.push({ job_id: job.id, result: await processJob(job, supabase) });
    }

    return new Response(
      JSON.stringify({ ok: true, processed_count: results.length, results }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

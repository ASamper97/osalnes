// ===========================================================================
// export-worker · Edge Function Supabase
// ===========================================================================
//
// Worker asíncrono que procesa jobs de exportación. Se invoca tras crear
// un job desde el RPC `exports_launch`.
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

interface ResourceRow {
  id: string;
  name_es: string;
  name_gl: string | null;
  slug: string;
  description_es: string | null;
  single_type_vocabulary: string | null;
  latitude: number | null;
  longitude: number | null;
  street_address: string | null;
  postal_code: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_web: string | null;
  municipality_id: string | null;
  publication_status: string;
  municipality_name: string | null;
  pid_missing_required: number;
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

// ─── Generación de payload por job_type (decisión 2-B) ─────────────────

async function buildPayload(
  resource: ResourceRow,
  jobType: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ payload: unknown; error?: ClassifiedError }> {
  // Validación previa de contenido obligatorio
  if (resource.pid_missing_required > 0) {
    return {
      payload: null,
      error: {
        category: 'content',
        message: `Faltan ${resource.pid_missing_required} campos obligatorios PID sin rellenar`,
        details: { missing_count: resource.pid_missing_required },
      },
    };
  }

  if (jobType === 'pid' || jobType === 'json_ld') {
    // JSON-LD schema.org (UNE 178503)
    const base: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': resource.single_type_vocabulary ?? 'TouristAttraction',
      '@id': `https://osalnes.gal/recurso/${resource.slug}`,
      name: resource.name_es,
    };
    if (resource.description_es) base.description = resource.description_es;
    if (resource.street_address) base.streetAddress = resource.street_address;
    if (resource.postal_code) base.postalCode = resource.postal_code;
    if (resource.municipality_name) base.addressLocality = resource.municipality_name;
    if (resource.latitude != null && resource.longitude != null) {
      base.geo = {
        '@type': 'GeoCoordinates',
        latitude: resource.latitude,
        longitude: resource.longitude,
      };
    }
    if (resource.contact_phone) base.telephone = resource.contact_phone;
    if (resource.contact_email) base.email = resource.contact_email;
    if (resource.contact_web) base.url = resource.contact_web;

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
        nameEs: resource.name_es,
        nameGl: resource.name_gl,
        description: resource.description_es,
        type: resource.single_type_vocabulary,
        municipalityId: resource.municipality_id,
        municipalityName: resource.municipality_name,
        latitude: resource.latitude,
        longitude: resource.longitude,
        address: {
          street: resource.street_address,
          postalCode: resource.postal_code,
        },
        contact: {
          phone: resource.contact_phone,
          email: resource.contact_email,
          web: resource.contact_web,
        },
        publicationStatus: resource.publication_status,
      },
    };
  }

  if (jobType === 'csv') {
    // Para CSV el "payload" es una fila plana que se agrega al archivo final
    return {
      payload: {
        id: resource.id,
        slug: resource.slug,
        name: resource.name_es ?? resource.name_gl ?? '',
        type: resource.single_type_vocabulary ?? '',
        municipality: resource.municipality_name ?? '',
        latitude: resource.latitude ?? '',
        longitude: resource.longitude ?? '',
        status: resource.publication_status,
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
  jobType: string,
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
  supabase: ReturnType<typeof createClient>,
): Promise<ProcessResult> {
  const startTime = Date.now();
  const result: ProcessResult = { processed: 0, failed: 0, skipped: 0 };

  // Marcar running
  await supabase
    .from('export_jobs')
    .update({ status: 'running' })
    .eq('id', job.id);

  // Cargar recursos del alcance con datos y cálculo de missing
  const { data: resources, error: resError } = await supabase.rpc('exports_load_scope_resources', {
    p_scope_ids: job.scope_ids,
  });

  if (resError) {
    // Si la RPC no existe aún, fallback a query directa
    const { data: resourcesFallback, error: fbErr } = await supabase
      .from('resources')
      .select(`
        id, name_es, name_gl, slug, description_es, single_type_vocabulary,
        latitude, longitude, street_address, postal_code,
        contact_phone, contact_email, contact_web,
        municipality_id, publication_status,
        municipalities:municipality_id ( name )
      `)
      .in('id', job.scope_ids);

    if (fbErr) {
      await markJobFailed(supabase, job.id, startTime, `Error cargando recursos: ${fbErr.message}`);
      return result;
    }

    for (const r of (resourcesFallback ?? []) as Record<string, unknown>[]) {
      const mun = (r.municipalities as Record<string, unknown> | null);
      const resource: ResourceRow = {
        id: String(r.id),
        name_es: String(r.name_es ?? ''),
        name_gl: (r.name_gl as string) ?? null,
        slug: String(r.slug ?? ''),
        description_es: (r.description_es as string) ?? null,
        single_type_vocabulary: (r.single_type_vocabulary as string) ?? null,
        latitude: (r.latitude as number) ?? null,
        longitude: (r.longitude as number) ?? null,
        street_address: (r.street_address as string) ?? null,
        postal_code: (r.postal_code as string) ?? null,
        contact_phone: (r.contact_phone as string) ?? null,
        contact_email: (r.contact_email as string) ?? null,
        contact_web: (r.contact_web as string) ?? null,
        municipality_id: (r.municipality_id as string) ?? null,
        publication_status: String(r.publication_status ?? 'draft'),
        municipality_name: (mun?.name as string) ?? null,
        pid_missing_required: 0, // se recalculará más abajo con una RPC
      };
      await processResource(job, resource, supabase, result);
    }
  } else {
    for (const r of (resources ?? []) as ResourceRow[]) {
      await processResource(job, r, supabase, result);
    }
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
  supabase: ReturnType<typeof createClient>,
  result: ProcessResult,
): Promise<void> {
  // 1) Construir payload
  const { payload, error: buildError } = await buildPayload(resource, job.job_type, supabase);

  if (buildError) {
    await supabase.from('export_job_records').insert({
      job_id: job.id,
      resource_id: resource.id,
      resource_name: resource.name_es,
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
      resource_name: resource.name_es,
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
    resource_name: resource.name_es,
    resource_slug: resource.slug,
    status: 'success',
    payload,
  });
  result.processed++;
}

async function markJobFailed(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  startTime: number,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from('export_jobs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error_message: errorMessage,
    })
    .eq('id', jobId);
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

      const result = await processJob(job as ExportJob, supabase);
      return new Response(
        JSON.stringify({ ok: true, job_id: body.job_id, result }),
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

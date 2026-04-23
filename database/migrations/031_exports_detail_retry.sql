-- ==========================================================================
-- Migration 031 — Centro de exportaciones (SCR-13) · Fase B
-- ==========================================================================
--
-- Añade las RPCs necesarias para:
--   · Drawer de detalle (job + records + resumen de errores)
--   · Descarga de payload agregado
--   · Descarga de log en texto plano
--   · Reintento con dos modos (total / solo fallidos)
--
-- Importante: adaptado al esquema español real (recurso_turistico,
-- estado_editorial='publicado', tr_get para traducciones). Mismo patrón
-- que la migración 030.
-- ==========================================================================


-- ─── 1) exports_get_detail ─────────────────────────────────────────────
--
-- Devuelve el resumen completo de un job para el drawer.

create or replace function public.exports_get_detail(
  p_job_id uuid
)
returns table (
  id uuid,
  job_type text,
  status text,
  scope_type text,
  records_total integer,
  records_processed integer,
  records_failed integer,
  records_skipped integer,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  triggered_by uuid,
  triggered_by_email text,
  notes text,
  retry_of uuid,
  is_retry boolean,
  scope_ids_count integer,
  error_summary jsonb
)
language sql
stable
as $$
  with job as (
    select
      ej.*,
      u.email as triggered_by_email,
      coalesce(array_length(ej.scope_ids, 1), 0) as scope_ids_count
    from public.export_jobs ej
    left join auth.users u on u.id = ej.triggered_by
    where ej.id = p_job_id
  ),
  err_summary as (
    -- Agrupación de errores por categoría para mostrar un resumen
    -- en la cabecera del drawer (ej: "3 de contenido, 1 de integración")
    select jsonb_object_agg(
      error_category,
      cnt
    ) as summary
    from (
      select error_category, count(*) as cnt
      from public.export_job_records
      where job_id = p_job_id
        and status = 'failed'
        and error_category is not null
      group by error_category
    ) e
  )
  select
    j.id,
    j.job_type,
    j.status,
    j.scope_type,
    j.records_total,
    j.records_processed,
    coalesce(j.records_failed, 0) as records_failed,
    coalesce(j.records_skipped, 0) as records_skipped,
    j.started_at,
    j.finished_at,
    j.duration_ms,
    j.triggered_by,
    j.triggered_by_email,
    j.notes,
    j.retry_of,
    (j.retry_of is not null) as is_retry,
    j.scope_ids_count::integer,
    coalesce((select summary from err_summary), '{}'::jsonb) as error_summary
  from job j;
$$;

comment on function public.exports_get_detail is
  'Detalle completo de un job para drawer SCR-13. Incluye resumen de errores por categoría.';


-- ─── 2) exports_get_records ────────────────────────────────────────────
--
-- Paginado de records (recursos procesados). Filtrable por estado
-- para el tab "Errores" del drawer.

create or replace function public.exports_get_records(
  p_job_id uuid,
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table (
  id uuid,
  resource_id uuid,
  resource_name text,
  resource_slug text,
  status text,
  error_category text,
  error_message text,
  error_details jsonb,
  has_payload boolean,
  processed_at timestamptz,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select
      ejr.*,
      (ejr.payload is not null) as has_payload
    from public.export_job_records ejr
    where ejr.job_id = p_job_id
      and (p_status is null or ejr.status = p_status)
  ),
  cnt as (
    select count(*) as total_count from filtered
  )
  select
    f.id, f.resource_id, f.resource_name, f.resource_slug,
    f.status, f.error_category, f.error_message, f.error_details,
    f.has_payload, f.processed_at,
    (select total_count from cnt) as total_count
  from filtered f
  order by
    case f.status when 'failed' then 0 when 'skipped' then 1 else 2 end,
    f.processed_at desc
  offset greatest(p_page - 1, 0) * p_page_size
  limit p_page_size;
$$;


-- ─── 3) exports_get_record_payload ─────────────────────────────────────
--
-- Devuelve el payload individual de un record (para inspección y
-- descarga puntual). Separado de records para no cargar JSONB masivos
-- en el listado.

create or replace function public.exports_get_record_payload(
  p_record_id uuid
)
returns jsonb
language sql
stable
as $$
  select payload from public.export_job_records where id = p_record_id;
$$;


-- ─── 4) exports_get_payload_bundle ─────────────────────────────────────
--
-- Agrega los payloads de todos los records de un job en un único JSON.
-- Decisión B2-C: un solo fichero agregado, estructura:
--   {
--     "job": { id, type, status, started_at, finished_at, ... },
--     "records": [
--       { resource_slug, resource_name, status, payload, error_* }
--     ]
--   }
--
-- Incluye tanto success como failed para auditoría completa.

create or replace function public.exports_get_payload_bundle(
  p_job_id uuid
)
returns jsonb
language sql
stable
as $$
  with job as (
    select id, job_type, status, scope_type, started_at, finished_at,
           records_total, records_processed, records_failed,
           duration_ms, notes
    from public.export_jobs where id = p_job_id
  ),
  records as (
    select jsonb_agg(
      jsonb_build_object(
        'resource_slug', resource_slug,
        'resource_name', resource_name,
        'resource_id', resource_id,
        'status', status,
        'payload', payload,
        'error_category', error_category,
        'error_message', error_message,
        'error_details', error_details,
        'processed_at', processed_at
      )
      order by status, processed_at
    ) as items
    from public.export_job_records
    where job_id = p_job_id
  )
  select jsonb_build_object(
    'job', (select to_jsonb(job.*) from job),
    'records', coalesce((select items from records), '[]'::jsonb),
    'generated_at', to_jsonb(now())
  );
$$;

comment on function public.exports_get_payload_bundle is
  'Bundle agregado de todos los records de un job. Usado para descarga JSON.';


-- ─── 5) exports_get_log_text ───────────────────────────────────────────
--
-- Genera un log en texto plano para descarga. Dos modos:
--   · sanitized=true  (decisión B3-C por defecto): trunca emails/teléfonos.
--   · sanitized=false (solo admin): incluye todo.
--
-- El cliente pasa el modo según permisos del usuario.

create or replace function public.exports_get_log_text(
  p_job_id uuid,
  p_sanitized boolean default true
)
returns text
language plpgsql
stable
as $$
declare
  v_job public.export_jobs%rowtype;
  v_log text := '';
  v_record record;
  v_payload_text text;
  v_user_email text;
begin
  select * into v_job from public.export_jobs where id = p_job_id;
  if not found then
    return 'Job no encontrado: ' || p_job_id::text;
  end if;

  select email into v_user_email from auth.users where id = v_job.triggered_by;

  -- Cabecera
  v_log := v_log || '================================================================' || E'\n';
  v_log := v_log || 'CENTRO DE EXPORTACIONES · O SALNES DTI' || E'\n';
  v_log := v_log || 'Log de exportación generado el ' || now()::text || E'\n';
  if p_sanitized then
    v_log := v_log || 'Modo: SANITIZADO (datos personales truncados)' || E'\n';
  else
    v_log := v_log || 'Modo: COMPLETO (solo admin)' || E'\n';
  end if;
  v_log := v_log || '================================================================' || E'\n\n';

  -- Bloque del job
  v_log := v_log || '>> DATOS DEL JOB' || E'\n';
  v_log := v_log || 'ID:             ' || v_job.id || E'\n';
  v_log := v_log || 'Tipo:           ' || v_job.job_type || E'\n';
  v_log := v_log || 'Estado:         ' || v_job.status || E'\n';
  v_log := v_log || 'Alcance:        ' || coalesce(v_job.scope_type, '-') || E'\n';
  v_log := v_log || 'Inicio:         ' || v_job.started_at::text || E'\n';
  v_log := v_log || 'Fin:            ' || coalesce(v_job.finished_at::text, '-') || E'\n';
  v_log := v_log || 'Duración (ms):  ' || coalesce(v_job.duration_ms::text, '-') || E'\n';
  v_log := v_log || 'Total recursos: ' || v_job.records_total || E'\n';
  v_log := v_log || 'OK:             ' || v_job.records_processed || E'\n';
  v_log := v_log || 'Fallidos:       ' || coalesce(v_job.records_failed, 0) || E'\n';
  v_log := v_log || 'Lanzado por:    ' || coalesce(
    case
      when p_sanitized and v_user_email is not null
      then regexp_replace(v_user_email, '^(.).*(@.*)$', '\1***\2')
      else v_user_email
    end, '-'
  ) || E'\n';
  if v_job.notes is not null then
    v_log := v_log || 'Notas:          ' || v_job.notes || E'\n';
  end if;
  if v_job.retry_of is not null then
    v_log := v_log || 'Reintento de:   ' || v_job.retry_of || E'\n';
  end if;
  v_log := v_log || E'\n';

  -- Records
  v_log := v_log || '>> RECURSOS PROCESADOS' || E'\n';
  v_log := v_log || '----------------------------------------------------------------' || E'\n';

  for v_record in
    select * from public.export_job_records
    where job_id = p_job_id
    order by
      case status when 'failed' then 0 when 'skipped' then 1 else 2 end,
      processed_at
  loop
    v_log := v_log || '[' || upper(v_record.status) || '] '
          || v_record.resource_slug
          || ' — ' || coalesce(v_record.resource_name, '(sin nombre)') || E'\n';

    if v_record.status = 'failed' then
      v_log := v_log || '        Categoría: ' || coalesce(v_record.error_category, '(sin clasificar)') || E'\n';
      v_log := v_log || '        Mensaje:   ' || coalesce(v_record.error_message, '(sin mensaje)') || E'\n';
      if v_record.error_details is not null and not p_sanitized then
        v_log := v_log || '        Detalles:  ' || v_record.error_details::text || E'\n';
      end if;
    elsif v_record.status = 'success' and v_record.payload is not null then
      if p_sanitized then
        -- En sanitized: solo mostrar los 4 campos clave del payload
        v_log := v_log || '        Exportado con type=' ||
          coalesce(v_record.payload->>'@type', '-') ||
          ', @id=' || coalesce(v_record.payload->>'@id', '-') || E'\n';
      else
        -- Modo completo: payload entero
        v_payload_text := v_record.payload::text;
        -- Truncar a 500 chars para que el log no sea infinito
        if length(v_payload_text) > 500 then
          v_payload_text := substring(v_payload_text, 1, 500) || '... [truncated]';
        end if;
        v_log := v_log || '        Payload:   ' || v_payload_text || E'\n';
      end if;
    end if;
  end loop;

  v_log := v_log || E'\n';
  v_log := v_log || '================================================================' || E'\n';
  v_log := v_log || 'Fin del log · UNE 178503 · DTI O Salnés' || E'\n';

  return v_log;
end;
$$;

comment on function public.exports_get_log_text is
  'Genera log en texto plano del job. Sanitiza datos personales si p_sanitized=true (default).';


-- ─── 6) exports_retry ──────────────────────────────────────────────────
--
-- Crea un nuevo job como reintento del padre. Dos modos (decisión 6-C):
--   · 'all'   → reprocesa todos los recursos del job original
--   · 'failed' → reprocesa solo los que fallaron
--
-- El nuevo job hereda job_type, scope_type, scope_filter del padre
-- (decisión B4-A). Marca retry_of con el UUID del padre para trazabilidad
-- y el badge "↻ Reintento" en la tabla.

create or replace function public.exports_retry(
  p_job_id uuid,
  p_mode text default 'all'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_parent public.export_jobs%rowtype;
  v_new_job_id uuid;
  v_new_scope_ids uuid[];
  v_total integer;
begin
  if p_mode not in ('all', 'failed') then
    raise exception 'Modo inválido: % (esperado "all" o "failed")', p_mode;
  end if;

  select * into v_parent from public.export_jobs where id = p_job_id;
  if not found then
    raise exception 'Job padre % no existe', p_job_id;
  end if;

  -- Determinar scope según modo
  if p_mode = 'all' then
    v_new_scope_ids := v_parent.scope_ids;
  else
    -- Solo los recursos que fallaron en el job padre
    select array_agg(distinct resource_id) into v_new_scope_ids
    from public.export_job_records
    where job_id = p_job_id
      and status = 'failed'
      and resource_id is not null;
  end if;

  v_total := coalesce(array_length(v_new_scope_ids, 1), 0);
  if v_total = 0 then
    raise exception 'No hay recursos que reintentar (modo: %)', p_mode;
  end if;

  -- Crear el nuevo job heredando tipo y alcance del padre
  insert into public.export_jobs (
    job_type, status, scope_type, scope_filter, scope_ids,
    records_total, triggered_by, retry_of, notes
  ) values (
    v_parent.job_type,
    'pending',
    case p_mode
      when 'failed' then 'selected'::text
      else coalesce(v_parent.scope_type, 'selected'::text)
    end,
    v_parent.scope_filter,
    v_new_scope_ids,
    v_total,
    auth.uid(),
    p_job_id,
    'Reintento de ' || p_job_id::text
      || ' (modo: ' || p_mode || ')'
      || case when v_parent.notes is not null then ' · ' || v_parent.notes else '' end
  )
  returning id into v_new_job_id;

  return v_new_job_id;
end;
$$;

comment on function public.exports_retry is
  'Crea un job de reintento. Modo all reprocesa todos, modo failed solo los fallidos.';

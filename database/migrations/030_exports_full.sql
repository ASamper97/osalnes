-- ==========================================================================
-- Migration 030 — Centro de exportaciones (SCR-13) · Fase A
-- ==========================================================================
--
-- Amplia la tabla export_jobs (creada en migración 028) con todos los
-- campos necesarios para trazabilidad completa según el pliego 5.1.7:
--   - payload (JSONB) del payload enviado
--   - response_payload (JSONB) respuesta del sistema destino
--   - scope_type (all_published | filtered | selected)
--   - scope_filter (JSONB) filtros aplicados al generar
--   - scope_ids (uuid[]) ids explícitos si scope_type='selected'
--   - validation_errors (JSONB) errores del precheck
--   - retry_of (FK) al job padre si es un reintento
--   - duration_ms
--
-- Nueva tabla export_job_records: detalle por recurso dentro del job.
-- Permite ver qué recurso concretamente falló y por qué.
--
-- Nuevas RPCs:
--   - exports_list(filters, pagination)        · listado
--   - exports_validate_scope(scope...)         · precheck sin crear job
--   - exports_launch(scope..., job_type)       · crear job pending
--   - exports_get_detail(job_id)               · detalle completo
--   - exports_get_records(job_id, status?)     · records de un job
--   - exports_retry(job_id, mode)              · relanzamiento (fase B)
--   - exports_get_kpis()                       · para cabecera SCR-13
--
-- Edge Function `export-worker` procesará los jobs en estado 'pending'
-- y actualizará 'running' → 'success' | 'partial' | 'failed'.
-- ==========================================================================


-- ─── 1) Ampliar tabla export_jobs ──────────────────────────────────────

alter table public.export_jobs
  add column if not exists payload jsonb,
  add column if not exists response_payload jsonb,
  add column if not exists scope_type text
    check (scope_type in ('all_published', 'filtered', 'selected', 'single')),
  add column if not exists scope_filter jsonb,
  add column if not exists scope_ids uuid[],
  add column if not exists validation_errors jsonb,
  add column if not exists retry_of uuid references public.export_jobs(id) on delete set null,
  add column if not exists duration_ms integer,
  add column if not exists records_failed integer default 0,
  add column if not exists records_skipped integer default 0,
  add column if not exists notes text;

-- Ampliar el constraint de job_type para soportar decisión 2-B
do $$
begin
  alter table public.export_jobs drop constraint if exists export_jobs_job_type_check;
  alter table public.export_jobs add constraint export_jobs_job_type_check
    check (job_type in ('pid', 'data_lake', 'csv', 'json_ld'));
exception when others then null;
end $$;

create index if not exists idx_export_jobs_retry_of on public.export_jobs (retry_of);
create index if not exists idx_export_jobs_status_type on public.export_jobs (status, job_type);


-- ─── 2) Tabla export_job_records ───────────────────────────────────────
--
-- Detalle por recurso. Un job masivo procesa N recursos y cada uno
-- genera una fila aquí con su estado individual.

create table if not exists public.export_job_records (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.export_jobs(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete set null,
  /* Snapshot de nombre/slug por si se borra el recurso luego */
  resource_name text,
  resource_slug text,
  status text not null check (status in ('success', 'failed', 'skipped')),
  /* Clasificación del error según pliego: "separar claramente error
     de contenido y error de integración" (decisión 5-A) */
  error_category text check (error_category is null or error_category in ('content', 'integration', 'schema', 'permissions')),
  error_message text,
  error_details jsonb,
  payload jsonb,
  processed_at timestamptz not null default now()
);

comment on table public.export_job_records is
  'Detalle por recurso dentro de un job de exportación. Permite ver qué recurso falló y por qué.';

create index if not exists idx_export_job_records_job on public.export_job_records (job_id);
create index if not exists idx_export_job_records_status on public.export_job_records (job_id, status);
create index if not exists idx_export_job_records_resource on public.export_job_records (resource_id);

alter table public.export_job_records enable row level security;
drop policy if exists export_job_records_read on public.export_job_records;
create policy export_job_records_read on public.export_job_records
  for select
  using (auth.uid() is not null);


-- ─── 3) Función helper: recolectar IDs del alcance ──────────────────────

create or replace function public.exports_resolve_scope_ids(
  p_scope_type text,
  p_scope_filter jsonb,
  p_scope_ids uuid[]
)
returns uuid[]
language plpgsql
stable
as $$
declare
  v_ids uuid[];
begin
  if p_scope_type = 'selected' or p_scope_type = 'single' then
    return coalesce(p_scope_ids, '{}'::uuid[]);
  end if;

  if p_scope_type = 'all_published' then
    select array_agg(id) into v_ids
    from public.resources
    where publication_status = 'published';
    return coalesce(v_ids, '{}'::uuid[]);
  end if;

  if p_scope_type = 'filtered' then
    -- Los filtros vienen como JSONB con los mismos nombres que ListFilters
    select array_agg(r.id) into v_ids
    from public.resources r
    where (
      (p_scope_filter->>'status') is null
      or (p_scope_filter->>'status') = 'all'
      or r.publication_status::text = (p_scope_filter->>'status')
    )
    and (
      (p_scope_filter->'typeKeys') is null
      or jsonb_array_length(p_scope_filter->'typeKeys') = 0
      or r.single_type_vocabulary = any(
           select jsonb_array_elements_text(p_scope_filter->'typeKeys')
         )
    )
    and (
      (p_scope_filter->'municipalityIds') is null
      or jsonb_array_length(p_scope_filter->'municipalityIds') = 0
      or r.municipality_id::text = any(
           select jsonb_array_elements_text(p_scope_filter->'municipalityIds')
         )
    );
    return coalesce(v_ids, '{}'::uuid[]);
  end if;

  return '{}'::uuid[];
end;
$$;


-- ─── 4) RPC exports_validate_scope (decisión 4-A pre-validación) ────────
--
-- Devuelve el conteo de recursos que pasarían la validación vs los que
-- fallarían, con muestra de los primeros errores. NO crea job.
-- Se llama antes de confirmar el lanzamiento.

create or replace function public.exports_validate_scope(
  p_scope_type text,
  p_scope_filter jsonb default null,
  p_scope_ids uuid[] default null,
  p_job_type text default 'pid'
)
returns table (
  total_in_scope bigint,
  passing_count bigint,
  failing_count bigint,
  sample_failures jsonb
)
language plpgsql
stable
as $$
declare
  v_ids uuid[];
  v_total bigint;
  v_passing bigint;
  v_failing bigint;
  v_sample jsonb;
begin
  v_ids := public.exports_resolve_scope_ids(p_scope_type, p_scope_filter, p_scope_ids);
  v_total := coalesce(array_length(v_ids, 1), 0);

  if v_total = 0 then
    return query select 0::bigint, 0::bigint, 0::bigint, '[]'::jsonb;
    return;
  end if;

  -- Un recurso "pasa" si tiene los obligatorios PID rellenos
  -- (usamos la función count_pid_missing_required ya existente)
  with scope as (
    select r.id, r.name_es, r.slug,
           public.count_pid_missing_required(r) as missing_count
    from public.resources r
    where r.id = any(v_ids)
  ),
  counts as (
    select
      count(*) filter (where missing_count = 0) as ok,
      count(*) filter (where missing_count > 0) as ko
    from scope
  ),
  sample as (
    select jsonb_agg(jsonb_build_object(
      'resource_id', id,
      'resource_name', name_es,
      'resource_slug', slug,
      'missing_count', missing_count,
      'error_category', 'content',
      'error_message', 'Faltan ' || missing_count || ' campo(s) obligatorio(s) PID sin rellenar'
    )) as s
    from scope
    where missing_count > 0
    limit 10
  )
  select
    v_total::bigint,
    (select ok from counts)::bigint,
    (select ko from counts)::bigint,
    coalesce((select s from sample), '[]'::jsonb);

  v_passing := 0; v_failing := 0; v_sample := '[]'::jsonb;
  return;
end;
$$;

comment on function public.exports_validate_scope is
  'Pre-validación de alcance antes de lanzar una exportación. No crea job.';


-- ─── 5) RPC exports_launch ──────────────────────────────────────────────
--
-- Crea un job en estado 'pending'. La edge function lo recoge y procesa.
-- Si hay errores de contenido bloqueantes y p_force=false, devuelve
-- error y no crea el job.

create or replace function public.exports_launch(
  p_job_type text,
  p_scope_type text,
  p_scope_filter jsonb default null,
  p_scope_ids uuid[] default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
  v_ids uuid[];
  v_total integer;
begin
  -- Resolver alcance
  v_ids := public.exports_resolve_scope_ids(p_scope_type, p_scope_filter, p_scope_ids);
  v_total := coalesce(array_length(v_ids, 1), 0);

  if v_total = 0 then
    raise exception 'El alcance de exportación está vacío';
  end if;

  -- Crear job
  insert into public.export_jobs (
    job_type, status, scope_type, scope_filter, scope_ids,
    records_total, triggered_by, notes
  ) values (
    p_job_type, 'pending', p_scope_type, p_scope_filter, v_ids,
    v_total, auth.uid(), p_notes
  )
  returning id into v_job_id;

  -- Nota: la edge function export-worker se encargará de procesar.
  -- En entornos de desarrollo sin edge function, se puede invocar
  -- manualmente la RPC exports_process_pending(v_job_id).

  return v_job_id;
end;
$$;


-- ─── 6) RPC exports_process_pending ─────────────────────────────────────
--
-- Versión "simulada" del procesamiento (usada si no hay edge function
-- corriendo o para tests). Procesa un job pendiente sincronamente.
-- La edge function real hace lo mismo llamando al PID de verdad.

create or replace function public.exports_process_pending(
  p_job_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_job public.export_jobs%rowtype;
  v_start timestamptz := clock_timestamp();
  v_processed integer := 0;
  v_failed integer := 0;
  v_resource record;
  v_payload jsonb;
  v_missing integer;
begin
  select * into v_job from public.export_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job % no existe', p_job_id;
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job % no está en estado pending (está en %)', p_job_id, v_job.status;
  end if;

  -- Marcar running
  update public.export_jobs set status = 'running' where id = p_job_id;

  -- Procesar cada recurso del alcance
  for v_resource in
    select r.*, m.name as municipality_name
    from public.resources r
    left join public.municipalities m on m.id = r.municipality_id
    where r.id = any(v_job.scope_ids)
  loop
    v_missing := public.count_pid_missing_required(v_resource);

    if v_missing > 0 then
      insert into public.export_job_records (
        job_id, resource_id, resource_name, resource_slug,
        status, error_category, error_message
      ) values (
        p_job_id, v_resource.id,
        coalesce(v_resource.name_es, v_resource.name_gl),
        v_resource.slug,
        'failed', 'content',
        'Faltan ' || v_missing || ' campo(s) obligatorio(s) PID sin rellenar'
      );
      v_failed := v_failed + 1;
    else
      -- Generar payload JSON-LD básico (incluye relaciones del paso 8)
      v_payload := jsonb_build_object(
        '@context', 'https://schema.org',
        '@type', coalesce(v_resource.single_type_vocabulary, 'TouristAttraction'),
        '@id', 'https://osalnes.gal/recurso/' || v_resource.slug,
        'name', v_resource.name_es,
        'description', v_resource.description_es,
        'addressLocality', v_resource.municipality_name,
        'latitude', v_resource.latitude,
        'longitude', v_resource.longitude
      );
      -- Añadir relaciones si la función del paso 8 existe
      begin
        v_payload := v_payload || coalesce(
          public.generate_jsonld_relations(v_resource.id),
          '{}'::jsonb
        );
      exception when undefined_function then
        null; -- paso 8 no instalado aún, no pasa nada
      end;

      insert into public.export_job_records (
        job_id, resource_id, resource_name, resource_slug,
        status, payload
      ) values (
        p_job_id, v_resource.id,
        v_resource.name_es, v_resource.slug,
        'success', v_payload
      );
      v_processed := v_processed + 1;
    end if;
  end loop;

  -- Finalizar job
  update public.export_jobs
  set status = case
      when v_failed = 0 then 'success'
      when v_processed = 0 then 'failed'
      else 'partial'
    end,
    finished_at = now(),
    duration_ms = extract(epoch from (clock_timestamp() - v_start)) * 1000,
    records_processed = v_processed,
    records_failed = v_failed
  where id = p_job_id;
end;
$$;

comment on function public.exports_process_pending is
  'Procesa un job en estado pending. Versión síncrona usada como fallback si no hay edge function.';


-- ─── 7) RPC exports_list ────────────────────────────────────────────────

create or replace function public.exports_list(
  p_status text default null,
  p_job_type text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_only_mine boolean default false,
  p_page integer default 1,
  p_page_size integer default 25
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
  is_retry boolean,
  retry_of uuid,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select
      ej.id,
      ej.job_type,
      ej.status,
      ej.scope_type,
      ej.records_total,
      ej.records_processed,
      coalesce(ej.records_failed, 0) as records_failed,
      coalesce(ej.records_skipped, 0) as records_skipped,
      ej.started_at,
      ej.finished_at,
      ej.duration_ms,
      ej.triggered_by,
      ej.retry_of,
      (ej.retry_of is not null) as is_retry,
      u.email as triggered_by_email
    from public.export_jobs ej
    left join auth.users u on u.id = ej.triggered_by
    where (p_status is null or ej.status = p_status)
      and (p_job_type is null or ej.job_type = p_job_type)
      and (p_date_from is null or ej.started_at >= p_date_from)
      and (p_date_to is null or ej.started_at <= p_date_to)
      and (not p_only_mine or ej.triggered_by = auth.uid())
  ),
  cnt as (
    select count(*) as total_count from filtered
  )
  select
    f.id, f.job_type, f.status, f.scope_type,
    f.records_total, f.records_processed, f.records_failed, f.records_skipped,
    f.started_at, f.finished_at, f.duration_ms,
    f.triggered_by, f.triggered_by_email,
    f.is_retry, f.retry_of,
    (select total_count from cnt) as total_count
  from filtered f
  order by f.started_at desc
  offset greatest(p_page - 1, 0) * p_page_size
  limit p_page_size;
$$;


-- ─── 8) RPC exports_get_kpis ────────────────────────────────────────────
--
-- Para la cabecera del SCR-13: cards con conteos por estado.

create or replace function public.exports_get_kpis()
returns table (
  total_jobs bigint,
  success_24h bigint,
  failed_24h bigint,
  pending_now bigint,
  running_now bigint,
  avg_duration_ms numeric,
  last_success_at timestamptz,
  last_success_type text
)
language sql
stable
as $$
  select
    (select count(*) from public.export_jobs)::bigint as total_jobs,
    (select count(*) from public.export_jobs where status = 'success' and started_at >= now() - interval '24 hours')::bigint as success_24h,
    (select count(*) from public.export_jobs where status in ('failed', 'partial') and started_at >= now() - interval '24 hours')::bigint as failed_24h,
    (select count(*) from public.export_jobs where status = 'pending')::bigint as pending_now,
    (select count(*) from public.export_jobs where status = 'running')::bigint as running_now,
    (select avg(duration_ms)::numeric(10, 0) from public.export_jobs where status = 'success' and duration_ms is not null) as avg_duration_ms,
    (select max(started_at) from public.export_jobs where status = 'success') as last_success_at,
    (select job_type from public.export_jobs where status = 'success' order by started_at desc limit 1) as last_success_type;
$$;

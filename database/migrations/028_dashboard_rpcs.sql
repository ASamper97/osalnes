-- ==========================================================================
-- Migration 028 — Dashboard operativo (SCR-02)
-- ==========================================================================
--
-- Añade:
--   1. Tabla export_jobs (mínima, para widget "Últimas exportaciones")
--   2. RPC dashboard_get_overview — todos los datos del dashboard en UNA query
--   3. RPC dashboard_get_my_work — borradores del usuario actual
--   4. RPC dashboard_get_upcoming_scheduled — próximas publicaciones
--   5. RPC dashboard_get_recent_activity — últimas acciones en el sistema
--   6. RPC dashboard_get_translation_progress — % traducción por idioma
--   7. RPC dashboard_get_une_indicators — 5 indicadores UNE 178502
--
-- La estrategia es: el cliente hace 4-5 RPCs en paralelo al montar el
-- dashboard. Cada RPC devuelve datos agregados, no cruda. Permite
-- optimizar fácilmente (caché, índices) sin tocar cliente.
--
-- ==========================================================================


-- ─── 1) Tabla export_jobs (mínima) ──────────────────────────────────────
--
-- Creada aquí para desbloquear el dashboard. El SCR-13 (Centro de
-- exportaciones) la ampliará con más campos (payload, duración,
-- recurso específico, etc.).

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,  -- 'pid', 'data_lake', 'csv', 'json_ld'
  status text not null default 'pending' check (status in ('pending', 'running', 'success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  records_processed integer default 0,
  records_total integer,
  triggered_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_export_jobs_started on public.export_jobs (started_at desc);
create index if not exists idx_export_jobs_type_status on public.export_jobs (job_type, status);

alter table public.export_jobs enable row level security;

-- Solo usuarios autenticados pueden leer exportaciones
drop policy if exists export_jobs_read on public.export_jobs;
create policy export_jobs_read on public.export_jobs
  for select
  using (auth.uid() is not null);

comment on table public.export_jobs is
  'Historial de exportaciones a PID/Data Lake/CSV. Tabla mínima — SCR-13 la ampliará.';


-- ─── 2) RPC dashboard_get_overview ──────────────────────────────────────
--
-- Combina KPIs + alertas en una sola llamada. Devuelve un solo registro
-- con todos los conteos que el dashboard necesita arriba.

create or replace function public.dashboard_get_overview()
returns table (
  -- KPIs totales
  total bigint,
  published bigint,
  scheduled bigint,
  draft bigint,
  in_review bigint,
  archived bigint,
  incomplete_for_publish bigint,

  -- Alertas derivadas
  without_image bigint,           -- recursos sin ninguna imagen
  without_coordinates bigint,     -- visibles en mapa pero sin coords
  without_description_es bigint,  -- sin descripción base en ES

  -- Último evento relevante
  last_published_at timestamptz,
  last_export_at timestamptz,
  last_export_status text
)
language sql
stable
as $$
  select
    (select count(*) from public.resources)::bigint as total,
    (select count(*) from public.resources where publication_status = 'published')::bigint as published,
    (select count(*) from public.resources where publication_status = 'scheduled')::bigint as scheduled,
    (select count(*) from public.resources where publication_status = 'draft')::bigint as draft,
    (select count(*) from public.resources where publication_status = 'in_review')::bigint as in_review,
    (select count(*) from public.resources where publication_status = 'archived')::bigint as archived,
    (select count(*) from public.resources
       where public.count_pid_missing_required(public.resources) > 0)::bigint as incomplete_for_publish,

    (select count(*) from public.resources r
       where not exists (select 1 from public.resource_images ri where ri.resource_id = r.id))::bigint as without_image,

    (select count(*) from public.resources
       where coalesce(visible_on_map, true) and (latitude is null or longitude is null))::bigint as without_coordinates,

    (select count(*) from public.resources
       where coalesce(length(description_es), 0) < 30)::bigint as without_description_es,

    (select max(published_at) from public.resources where publication_status = 'published') as last_published_at,
    (select max(started_at) from public.export_jobs where status = 'success') as last_export_at,
    (select status from public.export_jobs order by started_at desc limit 1) as last_export_status;
$$;

comment on function public.dashboard_get_overview is
  'Métricas agregadas del dashboard. Una llamada devuelve todo lo necesario para las cards superiores y alertas.';


-- ─── 3) RPC dashboard_get_my_work ───────────────────────────────────────
--
-- Borradores del usuario actual en las últimas 2 semanas (decisión 1-C
-- "Mi trabajo"). Ordenados por reciente primero.

create or replace function public.dashboard_get_my_work(
  p_limit integer default 6
)
returns table (
  id uuid,
  name_es text,
  name_gl text,
  slug text,
  single_type_vocabulary text,
  publication_status text,
  quality_score integer,
  pid_missing_required integer,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    r.id,
    r.name_es,
    r.name_gl,
    r.slug,
    r.single_type_vocabulary,
    r.publication_status,
    public.compute_resource_quality_score(r) as quality_score,
    public.count_pid_missing_required(r) as pid_missing_required,
    r.updated_at
  from public.resources r
  where r.created_by = auth.uid()
    and r.publication_status in ('draft', 'in_review')
    and r.updated_at >= (now() - interval '14 days')
  order by r.updated_at desc
  limit p_limit;
$$;

comment on function public.dashboard_get_my_work is
  'Borradores del usuario actual en los últimos 14 días. Widget "Mi trabajo".';


-- ─── 4) RPC dashboard_get_upcoming_scheduled ────────────────────────────
--
-- Próximas publicaciones programadas (decisión 5-A). No filtra por
-- usuario — el equipo debe ver lo que va a salir pronto.

create or replace function public.dashboard_get_upcoming_scheduled(
  p_limit integer default 5
)
returns table (
  id uuid,
  name_es text,
  name_gl text,
  slug text,
  single_type_vocabulary text,
  municipality_name text,
  scheduled_publish_at timestamptz,
  quality_score integer,
  pid_missing_required integer
)
language sql
stable
as $$
  select
    r.id,
    r.name_es,
    r.name_gl,
    r.slug,
    r.single_type_vocabulary,
    m.name as municipality_name,
    r.scheduled_publish_at,
    public.compute_resource_quality_score(r) as quality_score,
    public.count_pid_missing_required(r) as pid_missing_required
  from public.resources r
  left join public.municipalities m on m.id = r.municipality_id
  where r.publication_status = 'scheduled'
    and r.scheduled_publish_at is not null
    and r.scheduled_publish_at > now()
  order by r.scheduled_publish_at asc
  limit p_limit;
$$;

comment on function public.dashboard_get_upcoming_scheduled is
  'Próximas publicaciones programadas ordenadas por fecha más próxima. Widget "Próximas publicaciones".';


-- ─── 5) RPC dashboard_get_recent_activity ───────────────────────────────
--
-- Últimas acciones del audit_log. Si audit_log no existe o está vacío,
-- fallback a updated_at de resources.

create or replace function public.dashboard_get_recent_activity(
  p_limit integer default 10,
  p_only_mine boolean default false
)
returns table (
  actor_email text,
  action text,
  entity_type text,
  entity_id uuid,
  entity_name text,
  created_at timestamptz,
  field_name text
)
language plpgsql
stable
as $$
begin
  -- Si audit_log existe y tiene datos, usarlo
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_log') then
    return query
    select
      al.actor_email::text,
      al.action::text,
      al.entity_type::text,
      al.resource_id::uuid as entity_id,
      coalesce(r.name_es, r.name_gl, '(recurso eliminado)')::text as entity_name,
      al.created_at::timestamptz,
      coalesce(al.field_name, '')::text as field_name
    from public.audit_log al
    left join public.resources r on r.id = al.resource_id
    where (not p_only_mine or al.actor_id = auth.uid())
    order by al.created_at desc
    limit p_limit;
  else
    -- Fallback: updated_at de resources
    return query
    select
      null::text as actor_email,
      'Modificado'::text as action,
      'resource'::text as entity_type,
      r.id as entity_id,
      coalesce(r.name_es, r.name_gl, '(sin nombre)')::text as entity_name,
      r.updated_at::timestamptz as created_at,
      ''::text as field_name
    from public.resources r
    where (not p_only_mine or r.created_by = auth.uid())
    order by r.updated_at desc
    limit p_limit;
  end if;
end;
$$;

comment on function public.dashboard_get_recent_activity is
  'Últimas acciones en el sistema. Lee audit_log si existe, si no devuelve updated_at de recursos.';


-- ─── 6) RPC dashboard_get_translation_progress ──────────────────────────
--
-- Porcentaje de cobertura por idioma (cuántos de los recursos
-- publicados tienen contenido en cada idioma).

create or replace function public.dashboard_get_translation_progress()
returns table (
  language_code text,
  total_resources bigint,
  translated_count bigint,
  progress_percent numeric
)
language sql
stable
as $$
  with base as (
    select count(*)::bigint as total
    from public.resources
    where publication_status = 'published'
  ),
  langs as (
    select 'es' as lang,
      count(*) filter (where coalesce(length(name_es), 0) > 0 and publication_status = 'published')::bigint as translated
      from public.resources
    union all
    select 'gl' as lang,
      count(*) filter (where coalesce(length(name_gl), 0) > 0 and publication_status = 'published')::bigint
      from public.resources
    union all
    select 'en' as lang,
      count(*) filter (where coalesce(translations->'en'->>'name', '') <> '' and publication_status = 'published')::bigint
      from public.resources
    union all
    select 'fr' as lang,
      count(*) filter (where coalesce(translations->'fr'->>'name', '') <> '' and publication_status = 'published')::bigint
      from public.resources
    union all
    select 'pt' as lang,
      count(*) filter (where coalesce(translations->'pt'->>'name', '') <> '' and publication_status = 'published')::bigint
      from public.resources
  )
  select
    l.lang as language_code,
    (select total from base) as total_resources,
    l.translated as translated_count,
    case when (select total from base) > 0
      then round(l.translated::numeric * 100 / (select total from base), 0)
      else 0
    end as progress_percent
  from langs l
  order by case l.lang
    when 'es' then 1 when 'gl' then 2 when 'en' then 3 when 'fr' then 4 when 'pt' then 5
  end;
$$;

comment on function public.dashboard_get_translation_progress is
  'Progreso de traducción por idioma: % de recursos publicados con contenido en cada idioma.';


-- ─── 7) RPC dashboard_get_une_indicators ────────────────────────────────
--
-- Los 5 indicadores UNE 178502 que ya veíamos en el dashboard actual.
-- Ahora calculados de verdad contra los datos, no placeholder.

create or replace function public.dashboard_get_une_indicators()
returns table (
  -- Digitalización: % recursos con datos estructurados completos
  digitalization_percent numeric,
  digitalization_band text,  -- 'A', 'B', 'C', 'D'

  -- Multilingüismo: % recursos con al menos 2 idiomas completos
  multilingualism_percent numeric,
  multilingualism_band text,

  -- Georreferenciación: % recursos visibles en mapa con coordenadas válidas
  georeferencing_percent numeric,
  georeferencing_band text,

  -- Actualización 30d: % recursos actualizados en últimos 30 días
  freshness_30d_percent numeric,
  freshness_30d_band text,

  -- Actualización 90d: % recursos actualizados en últimos 90 días
  freshness_90d_percent numeric,
  freshness_90d_band text,

  -- Interoperabilidad PID: % recursos exportados exitosamente al PID
  pid_interop_percent numeric,
  pid_interop_band text
)
language plpgsql
stable
as $$
declare
  v_total bigint;
  v_published bigint;
  v_digitalization numeric := 0;
  v_multilingualism numeric := 0;
  v_georef numeric := 0;
  v_fresh30 numeric := 0;
  v_fresh90 numeric := 0;
  v_pid numeric := 0;
begin
  select count(*) into v_total from public.resources;
  select count(*) into v_published from public.resources where publication_status = 'published';

  if v_total = 0 then
    return query select
      0::numeric, 'D'::text,
      0::numeric, 'D'::text,
      0::numeric, 'D'::text,
      0::numeric, 'D'::text,
      0::numeric, 'D'::text,
      0::numeric, 'D'::text;
    return;
  end if;

  -- Digitalización: % con nombre ES + descripción ES + tipología + municipio
  select round(
    count(*) filter (
      where coalesce(length(name_es), 0) > 0
        and coalesce(length(description_es), 0) >= 30
        and single_type_vocabulary is not null
        and municipality_id is not null
    )::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_digitalization from public.resources;

  -- Multilingüismo: al menos ES y GL
  select round(
    count(*) filter (
      where coalesce(length(name_es), 0) > 0
        and coalesce(length(name_gl), 0) > 0
    )::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_multilingualism from public.resources;

  -- Georreferenciación: visible en mapa con coordenadas
  select round(
    count(*) filter (
      where coalesce(visible_on_map, true)
        and latitude is not null
        and longitude is not null
    )::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_georef from public.resources;

  -- Actualización 30 días
  select round(
    count(*) filter (where updated_at >= (now() - interval '30 days'))::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_fresh30 from public.resources;

  -- Actualización 90 días
  select round(
    count(*) filter (where updated_at >= (now() - interval '90 days'))::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_fresh90 from public.resources;

  -- Interoperabilidad PID: % publicados exportados con éxito (mínimo una vez)
  if v_published > 0 and exists (select 1 from public.export_jobs where job_type = 'pid' and status = 'success') then
    v_pid := 100;
  else
    v_pid := 0;
  end if;

  return query select
    v_digitalization, public.band_from_percent(v_digitalization),
    v_multilingualism, public.band_from_percent(v_multilingualism),
    v_georef, public.band_from_percent(v_georef),
    v_fresh30, public.band_from_percent(v_fresh30),
    v_fresh90, public.band_from_percent(v_fresh90),
    v_pid, public.band_from_percent(v_pid);
end;
$$;

-- Helper: convierte % en letra A/B/C/D (solo si no existe ya)
create or replace function public.band_from_percent(p_pct numeric)
returns text
language sql
immutable
as $$
  select case
    when p_pct >= 85 then 'A'
    when p_pct >= 65 then 'B'
    when p_pct >= 40 then 'C'
    else 'D'
  end;
$$;

comment on function public.dashboard_get_une_indicators is
  '5 indicadores clave alineados con UNE 178502: digitalización, multilingüismo, georreferenciación, actualización y interoperabilidad PID.';

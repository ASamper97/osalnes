-- ==========================================================================
-- Migration 028 — Dashboard operativo (SCR-02)
-- ==========================================================================
--
-- Adaptado al schema real (mismas divergencias que 026/027):
--   - Tabla `recurso_turistico` (NO `resources`).
--   - `estado_editorial` Spanish (NO `publication_status` English).
--     Valores: 'borrador' | 'revision' | 'programado' | 'publicado' | 'archivado'.
--   - `visible_en_mapa` (NO `visible_on_map`).
--   - `municipio_id` + tabla `municipio` (NO `municipality_id` + `municipalities`).
--   - `name_es`/`name_gl`/`description_es`/`description_gl` viven en
--     `traduccion` (NO columnas): resueltas con `tr_get()` helper de 026.
--   - `rdf_type` (NO `single_type_vocabulary`).
--   - `log_cambios` (NO `audit_log`): columnas `accion/usuario_id/cambios
--     jsonb/entidad_tipo/entidad_id/created_at`. El actor_email se
--     resuelve via JOIN con `usuario`.
--   - `compute_resource_quality_score(uuid)` y
--     `count_pid_missing_required(uuid)` tienen firma por UUID (cambiada
--     en 026 para desacoplarlas del shape de la view).
--
-- Añade:
--   1. Tabla export_jobs (mínima para widget "Última exportación").
--   2. Helper band_from_percent.
--   3. 6 RPCs dashboard_get_* para alimentar los 11 widgets.
--
-- El return shape de los RPCs usa snake_case English (el dashboard.ts
-- del shared los consume así). `publication_status` devuelve el valor
-- Spanish real del BD — el cliente hace el match `'borrador'|'revision'`.
-- ==========================================================================


-- ─── 1) Tabla export_jobs (mínima) ──────────────────────────────────────

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

drop policy if exists export_jobs_read on public.export_jobs;
create policy export_jobs_read on public.export_jobs
  for select
  using (auth.uid() is not null);

comment on table public.export_jobs is
  'Historial de exportaciones a PID/Data Lake/CSV. Tabla mínima — SCR-13 la ampliará.';


-- ─── 2) Helper band_from_percent ────────────────────────────────────────

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


-- ─── 3) RPC dashboard_get_overview ──────────────────────────────────────

create or replace function public.dashboard_get_overview()
returns table (
  total bigint,
  published bigint,
  scheduled bigint,
  draft bigint,
  in_review bigint,
  archived bigint,
  incomplete_for_publish bigint,

  without_image bigint,
  without_coordinates bigint,
  without_description_es bigint,

  last_published_at timestamptz,
  last_export_at timestamptz,
  last_export_status text
)
language sql
stable
as $$
  select
    (select count(*) from public.recurso_turistico)::bigint as total,
    (select count(*) from public.recurso_turistico where estado_editorial = 'publicado')::bigint as published,
    (select count(*) from public.recurso_turistico where estado_editorial = 'programado')::bigint as scheduled,
    (select count(*) from public.recurso_turistico where estado_editorial = 'borrador')::bigint as draft,
    (select count(*) from public.recurso_turistico where estado_editorial = 'revision')::bigint as in_review,
    (select count(*) from public.recurso_turistico where estado_editorial = 'archivado')::bigint as archived,
    (select count(*) from public.recurso_turistico r
       where public.count_pid_missing_required(r.id) > 0)::bigint as incomplete_for_publish,

    (select count(*) from public.recurso_turistico r
       where not exists (select 1 from public.resource_images ri where ri.resource_id = r.id))::bigint as without_image,

    (select count(*) from public.recurso_turistico
       where coalesce(visible_en_mapa, true) and (latitude is null or longitude is null))::bigint as without_coordinates,

    (select count(*) from public.recurso_turistico r
       where coalesce(length(public.tr_get('recurso_turistico', r.id, 'description', 'es')), 0) < 30)::bigint as without_description_es,

    (select max(published_at) from public.recurso_turistico where estado_editorial = 'publicado') as last_published_at,
    (select max(started_at) from public.export_jobs where status = 'success') as last_export_at,
    ((select status from public.export_jobs order by started_at desc limit 1))::text as last_export_status;
$$;

comment on function public.dashboard_get_overview is
  'Métricas agregadas del dashboard. Una llamada devuelve todo lo necesario para las cards superiores y alertas.';


-- ─── 4) RPC dashboard_get_my_work ───────────────────────────────────────

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
    public.tr_get('recurso_turistico', r.id, 'name', 'es') as name_es,
    public.tr_get('recurso_turistico', r.id, 'name', 'gl') as name_gl,
    r.slug::text,
    r.rdf_type::text as single_type_vocabulary,
    r.estado_editorial::text as publication_status,
    public.compute_resource_quality_score(r.id) as quality_score,
    public.count_pid_missing_required(r.id) as pid_missing_required,
    r.updated_at
  from public.recurso_turistico r
  where r.created_by = auth.uid()
    and r.estado_editorial in ('borrador', 'revision')
    and r.updated_at >= (now() - interval '14 days')
  order by r.updated_at desc
  limit p_limit;
$$;

comment on function public.dashboard_get_my_work is
  'Borradores del usuario actual en los últimos 14 días. Widget "Mi trabajo". Devuelve estado_editorial en Spanish (el cliente lo matchea con valores reales).';


-- ─── 5) RPC dashboard_get_upcoming_scheduled ────────────────────────────

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
    public.tr_get('recurso_turistico', r.id, 'name', 'es') as name_es,
    public.tr_get('recurso_turistico', r.id, 'name', 'gl') as name_gl,
    r.slug::text,
    r.rdf_type::text as single_type_vocabulary,
    coalesce(
      public.tr_get('municipio', r.municipio_id, 'name', 'es'),
      m.slug::text
    ) as municipality_name,
    r.scheduled_publish_at,
    public.compute_resource_quality_score(r.id) as quality_score,
    public.count_pid_missing_required(r.id) as pid_missing_required
  from public.recurso_turistico r
  left join public.municipio m on m.id = r.municipio_id
  where r.estado_editorial = 'programado'
    and r.scheduled_publish_at is not null
    and r.scheduled_publish_at > now()
  order by r.scheduled_publish_at asc
  limit p_limit;
$$;

comment on function public.dashboard_get_upcoming_scheduled is
  'Próximas publicaciones programadas ordenadas por fecha más próxima. Widget "Próximas publicaciones".';


-- ─── 6) RPC dashboard_get_recent_activity ───────────────────────────────
--
-- Usa `log_cambios` (tabla real del repo, migración 001+013). El
-- actor_email se resuelve via JOIN con `usuario`. Fallback a
-- updated_at de recurso_turistico si log_cambios está vacío.

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
declare
  v_has_log_cambios boolean;
  v_log_has_data boolean := false;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'log_cambios'
  ) into v_has_log_cambios;

  if v_has_log_cambios then
    select exists (select 1 from public.log_cambios limit 1) into v_log_has_data;
  end if;

  if v_log_has_data then
    return query
    select
      u.email::text as actor_email,
      lc.accion::text as action,
      lc.entidad_tipo::text as entity_type,
      lc.entidad_id as entity_id,
      coalesce(
        public.tr_get('recurso_turistico', lc.entidad_id, 'name', 'es'),
        public.tr_get('recurso_turistico', lc.entidad_id, 'name', 'gl'),
        '(recurso eliminado)'
      )::text as entity_name,
      lc.created_at,
      coalesce(
        case
          when lc.cambios ? 'fields' and jsonb_typeof(lc.cambios->'fields') = 'array'
            then (lc.cambios->'fields'->>0)
          else null
        end,
        ''
      )::text as field_name
    from public.log_cambios lc
    left join public.usuario u on u.id = lc.usuario_id
    where lc.entidad_tipo = 'recurso_turistico'
      and (not p_only_mine or lc.usuario_id = auth.uid())
    order by lc.created_at desc
    limit p_limit;
  else
    return query
    select
      null::text as actor_email,
      'modificar'::text as action,
      'recurso_turistico'::text as entity_type,
      r.id as entity_id,
      coalesce(
        public.tr_get('recurso_turistico', r.id, 'name', 'es'),
        public.tr_get('recurso_turistico', r.id, 'name', 'gl'),
        '(sin nombre)'
      )::text as entity_name,
      r.updated_at as created_at,
      ''::text as field_name
    from public.recurso_turistico r
    where (not p_only_mine or r.created_by = auth.uid())
    order by r.updated_at desc
    limit p_limit;
  end if;
end;
$$;

comment on function public.dashboard_get_recent_activity is
  'Últimas acciones en el sistema. Lee log_cambios (tabla real del repo) con JOIN a usuario para actor_email; fallback a updated_at de recurso_turistico si log vacío.';


-- ─── 7) RPC dashboard_get_translation_progress ──────────────────────────

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
    from public.recurso_turistico
    where estado_editorial = 'publicado'
  ),
  langs as (
    -- ES via traduccion
    select 'es'::text as lang,
      count(*) filter (
        where coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'es')), 0) > 0
          and r.estado_editorial = 'publicado'
      )::bigint as translated
      from public.recurso_turistico r
    union all
    -- GL via traduccion
    select 'gl'::text as lang,
      count(*) filter (
        where coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'gl')), 0) > 0
          and r.estado_editorial = 'publicado'
      )::bigint
      from public.recurso_turistico r
    union all
    -- EN desde jsonb translations (paso 6 · migración 024)
    select 'en'::text as lang,
      count(*) filter (
        where coalesce(translations->'en'->>'name', '') <> ''
          and estado_editorial = 'publicado'
      )::bigint
      from public.recurso_turistico
    union all
    select 'fr'::text as lang,
      count(*) filter (
        where coalesce(translations->'fr'->>'name', '') <> ''
          and estado_editorial = 'publicado'
      )::bigint
      from public.recurso_turistico
    union all
    select 'pt'::text as lang,
      count(*) filter (
        where coalesce(translations->'pt'->>'name', '') <> ''
          and estado_editorial = 'publicado'
      )::bigint
      from public.recurso_turistico
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
  'Progreso de traducción por idioma: % de recursos publicados con contenido en cada idioma. ES/GL desde tabla traduccion; EN/FR/PT desde jsonb translations del paso 6.';


-- ─── 8) RPC dashboard_get_une_indicators ────────────────────────────────
--
-- Los 5 indicadores UNE 178502 heurísticos (no métricas oficiales —
-- aviso 3 del prompt: si auditoría exige oficiales, ajustar fórmulas).

create or replace function public.dashboard_get_une_indicators()
returns table (
  digitalization_percent numeric,
  digitalization_band text,

  multilingualism_percent numeric,
  multilingualism_band text,

  georeferencing_percent numeric,
  georeferencing_band text,

  freshness_30d_percent numeric,
  freshness_30d_band text,

  freshness_90d_percent numeric,
  freshness_90d_band text,

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
  select count(*) into v_total from public.recurso_turistico;
  select count(*) into v_published from public.recurso_turistico where estado_editorial = 'publicado';

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

  -- Digitalización: % con nombre ES + descripción ES (≥30 chars) + tipología + municipio
  select round(
    count(*) filter (
      where coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'es')), 0) > 0
        and coalesce(length(public.tr_get('recurso_turistico', r.id, 'description', 'es')), 0) >= 30
        and r.rdf_type is not null and r.rdf_type <> ''
        and r.municipio_id is not null
    )::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_digitalization from public.recurso_turistico r;

  -- Multilingüismo: ES y GL
  select round(
    count(*) filter (
      where coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'es')), 0) > 0
        and coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'gl')), 0) > 0
    )::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_multilingualism from public.recurso_turistico r;

  -- Georreferenciación: visible_en_mapa + coordenadas
  select round(
    count(*) filter (
      where coalesce(visible_en_mapa, true)
        and latitude is not null
        and longitude is not null
    )::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_georef from public.recurso_turistico;

  -- Actualización 30 días
  select round(
    count(*) filter (where updated_at >= (now() - interval '30 days'))::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_fresh30 from public.recurso_turistico;

  -- Actualización 90 días
  select round(
    count(*) filter (where updated_at >= (now() - interval '90 days'))::numeric * 100 / greatest(v_total, 1),
    0
  ) into v_fresh90 from public.recurso_turistico;

  -- Interoperabilidad PID
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

comment on function public.dashboard_get_une_indicators is
  '6 indicadores heurísticos alineados con UNE 178502: digitalización, multilingüismo, georreferenciación, actualización 30d/90d, interoperabilidad PID. NO son métricas oficiales del INE/Ministerio (aviso 3 del prompt 13): si auditoría exige oficiales, ajustar fórmulas.';

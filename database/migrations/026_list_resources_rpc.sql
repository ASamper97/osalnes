-- ==========================================================================
-- Migration 026 — RPC list_resources para el listado rico (SCR-03)
-- ==========================================================================
--
-- Crea una función que devuelve los recursos con TODOS los campos
-- derivados que el listado necesita en una sola query:
--   - Datos base (id, nombre, tipología, municipio, estado, idiomas)
--   - Flags (visible_on_map, has_coordinates, tiene_traducciones_EN/FR/PT)
--   - Nota de calidad 0-100 (aproximada desde datos disponibles)
--   - PID incompleto (count de campos obligatorios sin rellenar)
--   - Último editor (audit_log si existe) + fecha
--
-- Incluye filtros facetados como parámetros opcionales y paginación.
--
-- ==========================================================================


-- 1) Función que calcula nota de calidad aproximada -----------------------
--
-- Es una versión simplificada del motor de quality-engine.ts (que corre
-- en cliente). Aquí en SQL hacemos una nota aproximada con los campos
-- que afectan más al score global.

create or replace function public.compute_resource_quality_score(r public.resources)
returns integer
language plpgsql
immutable
as $$
declare
  v_score integer := 100;
  v_images_count integer;
  v_images_without_alt integer;
  v_tags_count integer;
begin
  -- Identificación
  if r.single_type_vocabulary is null then v_score := v_score - 15; end if;
  if coalesce(r.name_es, '') = '' then v_score := v_score - 12; end if;
  if coalesce(r.name_gl, '') = '' then v_score := v_score - 5; end if;
  if r.municipality_id is null then v_score := v_score - 10; end if;

  -- Contenido
  if coalesce(length(r.description_es), 0) < 30 then v_score := v_score - 10; end if;
  if coalesce(length(r.description_gl), 0) < 30 then v_score := v_score - 5; end if;

  -- Ubicación
  if coalesce(r.visible_on_map, true) and (r.latitude is null or r.longitude is null) then
    v_score := v_score - 12;
  end if;

  -- Multimedia
  select count(*), count(*) filter (where alt_text is null or alt_text = '')
    into v_images_count, v_images_without_alt
    from public.resource_images
    where resource_id = r.id;

  if v_images_count = 0 then v_score := v_score - 12; end if;
  if v_images_without_alt > 0 then v_score := v_score - 8; end if;

  -- Clasificación (tags)
  select count(*) into v_tags_count
    from public.resource_tags
    where resource_id = r.id
      and tag_key not like 'curaduria-editorial.%';

  if v_tags_count = 0 then v_score := v_score - 10;
  elsif v_tags_count < 3 then v_score := v_score - 5;
  end if;

  -- SEO
  if coalesce(r.seo_by_lang->'es'->>'title', '') = '' then v_score := v_score - 5; end if;
  if coalesce(r.seo_by_lang->'es'->>'description', '') = '' then v_score := v_score - 5; end if;

  return greatest(0, v_score);
end;
$$;

comment on function public.compute_resource_quality_score(public.resources) is
  'Nota aproximada 0-100 de calidad del recurso. Versión simplificada del motor quality-engine.ts para uso en listados. El cliente hace cálculo exacto al abrir la ficha.';


-- 2) Función que cuenta campos PID obligatorios sin rellenar -------------

create or replace function public.count_pid_missing_required(r public.resources)
returns integer
language plpgsql
immutable
as $$
declare
  v_missing integer := 0;
begin
  if r.single_type_vocabulary is null then v_missing := v_missing + 1; end if;
  if r.municipality_id is null then v_missing := v_missing + 1; end if;
  return v_missing;
end;
$$;


-- 3) Vista enriquecida --------------------------------------------------

create or replace view public.resources_list_view as
select
  r.*,
  -- Idiomas con contenido mínimo (ES y GL tienen name; EN/FR/PT via translations)
  (case when coalesce(length(r.name_es), 0) > 0 then true else false end) as has_lang_es,
  (case when coalesce(length(r.name_gl), 0) > 0 then true else false end) as has_lang_gl,
  (case when coalesce(r.translations->'en'->>'name', '') <> '' then true else false end) as has_lang_en,
  (case when coalesce(r.translations->'fr'->>'name', '') <> '' then true else false end) as has_lang_fr,
  (case when coalesce(r.translations->'pt'->>'name', '') <> '' then true else false end) as has_lang_pt,
  -- Ubicación
  (r.latitude is not null and r.longitude is not null) as has_coordinates,
  -- Calidad y PID
  public.compute_resource_quality_score(r) as quality_score,
  public.count_pid_missing_required(r) as pid_missing_required,
  -- Municipio nombre (join barato al ser lookup pequeño)
  m.name as municipality_name,
  m.slug as municipality_slug,
  -- Último editor (si hay audit_log)
  (select actor_email from public.audit_log al
    where al.resource_id = r.id
    order by al.created_at desc limit 1) as last_editor_email
from public.resources r
left join public.municipalities m on m.id = r.municipality_id;

comment on view public.resources_list_view is
  'Vista enriquecida con todos los campos derivados que el listado necesita: flags de idioma, coordenadas, score de calidad, y último editor.';


-- 4) RPC principal: listar con filtros + paginación + orden --------------

create or replace function public.list_resources(
  -- Filtros
  p_search text default null,                 -- búsqueda en nombre ES/GL
  p_status text default null,                 -- 'draft', 'published', 'scheduled', 'archived', 'in_review'
  p_type_keys text[] default null,            -- multi-select tipologías
  p_municipality_ids uuid[] default null,     -- multi-select municipios
  p_languages_missing text[] default null,    -- idiomas sin traducir: ['en', 'fr']
  p_visible_on_map boolean default null,      -- true/false/null
  p_has_coordinates boolean default null,     -- true/false/null
  p_incomplete_for_publish boolean default null, -- true = pid_missing > 0
  p_owner_id uuid default null,               -- "solo mis recursos"
  -- Orden
  p_order_by text default 'updated_at',       -- 'name'|'updated_at'|'quality_score'|'municipality'
  p_order_dir text default 'desc',            -- 'asc'|'desc'
  -- Paginación
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  id uuid,
  name_es text,
  name_gl text,
  slug text,
  single_type_vocabulary text,
  publication_status text,
  municipality_id uuid,
  municipality_name text,
  municipality_slug text,
  has_lang_es boolean,
  has_lang_gl boolean,
  has_lang_en boolean,
  has_lang_fr boolean,
  has_lang_pt boolean,
  has_coordinates boolean,
  visible_on_map boolean,
  quality_score integer,
  pid_missing_required integer,
  scheduled_publish_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz,
  last_editor_email text,
  total_count bigint  -- para paginación
)
language plpgsql
stable
as $$
declare
  v_total bigint;
begin
  -- Primera pasada: contar total (igual filtros, sin paginación)
  select count(*) into v_total
  from public.resources_list_view r
  where
    (p_search is null or
       r.name_es ilike '%' || p_search || '%' or
       r.name_gl ilike '%' || p_search || '%')
    and (p_status is null or r.publication_status = p_status)
    and (p_type_keys is null or r.single_type_vocabulary = any(p_type_keys))
    and (p_municipality_ids is null or r.municipality_id = any(p_municipality_ids))
    and (p_visible_on_map is null or coalesce(r.visible_on_map, true) = p_visible_on_map)
    and (p_has_coordinates is null or r.has_coordinates = p_has_coordinates)
    and (p_incomplete_for_publish is null
         or (p_incomplete_for_publish and r.pid_missing_required > 0)
         or (not p_incomplete_for_publish and r.pid_missing_required = 0))
    and (p_languages_missing is null or (
      ('en' = any(p_languages_missing) and not r.has_lang_en) or
      ('fr' = any(p_languages_missing) and not r.has_lang_fr) or
      ('pt' = any(p_languages_missing) and not r.has_lang_pt) or
      ('gl' = any(p_languages_missing) and not r.has_lang_gl)
    ))
    and (p_owner_id is null or r.created_by = p_owner_id);

  -- Segunda: devolver página
  return query
  select
    r.id, r.name_es, r.name_gl, r.slug, r.single_type_vocabulary,
    r.publication_status, r.municipality_id, r.municipality_name, r.municipality_slug,
    r.has_lang_es, r.has_lang_gl, r.has_lang_en, r.has_lang_fr, r.has_lang_pt,
    r.has_coordinates, coalesce(r.visible_on_map, true) as visible_on_map,
    r.quality_score, r.pid_missing_required,
    r.scheduled_publish_at, r.published_at, r.updated_at, r.last_editor_email,
    v_total as total_count
  from public.resources_list_view r
  where
    (p_search is null or
       r.name_es ilike '%' || p_search || '%' or
       r.name_gl ilike '%' || p_search || '%')
    and (p_status is null or r.publication_status = p_status)
    and (p_type_keys is null or r.single_type_vocabulary = any(p_type_keys))
    and (p_municipality_ids is null or r.municipality_id = any(p_municipality_ids))
    and (p_visible_on_map is null or coalesce(r.visible_on_map, true) = p_visible_on_map)
    and (p_has_coordinates is null or r.has_coordinates = p_has_coordinates)
    and (p_incomplete_for_publish is null
         or (p_incomplete_for_publish and r.pid_missing_required > 0)
         or (not p_incomplete_for_publish and r.pid_missing_required = 0))
    and (p_languages_missing is null or (
      ('en' = any(p_languages_missing) and not r.has_lang_en) or
      ('fr' = any(p_languages_missing) and not r.has_lang_fr) or
      ('pt' = any(p_languages_missing) and not r.has_lang_pt) or
      ('gl' = any(p_languages_missing) and not r.has_lang_gl)
    ))
    and (p_owner_id is null or r.created_by = p_owner_id)
  order by
    case when p_order_by = 'name' and p_order_dir = 'asc' then r.name_es end asc,
    case when p_order_by = 'name' and p_order_dir = 'desc' then r.name_es end desc,
    case when p_order_by = 'quality_score' and p_order_dir = 'asc' then r.quality_score end asc,
    case when p_order_by = 'quality_score' and p_order_dir = 'desc' then r.quality_score end desc,
    case when p_order_by = 'municipality' and p_order_dir = 'asc' then r.municipality_name end asc,
    case when p_order_by = 'municipality' and p_order_dir = 'desc' then r.municipality_name end desc,
    case when p_order_by = 'updated_at' and p_order_dir = 'asc' then r.updated_at end asc,
    case when p_order_by = 'updated_at' and p_order_dir = 'desc' then r.updated_at end desc,
    r.updated_at desc  -- fallback
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

comment on function public.list_resources is
  'Lista recursos con filtros facetados, orden configurable y paginación. Devuelve total_count en cada fila para mostrar paginación correcta. Diseñado para SCR-03.';


-- 5) RPC: estadísticas globales del dashboard KPI ------------------------

create or replace function public.list_resources_kpis(
  p_owner_id uuid default null
)
returns table (
  total bigint,
  published bigint,
  scheduled bigint,
  draft bigint,
  archived bigint,
  incomplete_for_publish bigint
)
language sql
stable
as $$
  select
    count(*)::bigint as total,
    count(*) filter (where publication_status = 'published')::bigint as published,
    count(*) filter (where publication_status = 'scheduled')::bigint as scheduled,
    count(*) filter (where publication_status = 'draft')::bigint as draft,
    count(*) filter (where publication_status = 'archived')::bigint as archived,
    count(*) filter (where public.count_pid_missing_required(r) > 0)::bigint as incomplete_for_publish
  from public.resources r
  where p_owner_id is null or r.created_by = p_owner_id;
$$;

comment on function public.list_resources_kpis is
  'KPIs agregados para el dashboard superior del listado. Si p_owner_id se pasa, filtra por recursos de ese usuario ("solo mis recursos").';


-- 6) RPC: cambiar estado de un recurso individual ------------------------

create or replace function public.change_resource_status(
  p_resource_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
as $$
begin
  if p_new_status not in ('draft', 'published', 'scheduled', 'archived', 'in_review') then
    raise exception 'Estado inválido: %', p_new_status;
  end if;

  update public.resources
  set publication_status = p_new_status,
      published_at = case when p_new_status = 'published' then now() else published_at end,
      published_by = case when p_new_status = 'published' then auth.uid() else published_by end,
      scheduled_publish_at = case when p_new_status <> 'scheduled' then null else scheduled_publish_at end
  where id = p_resource_id;
end;
$$;

comment on function public.change_resource_status is
  'Cambia el estado de publicación de un recurso. Usado desde el menú "..." del listado para acciones rápidas sin abrir la ficha.';

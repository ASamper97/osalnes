-- ==========================================================================
-- Migration 026 — RPC list_resources para el listado rico (SCR-03)
-- ==========================================================================
--
-- Adaptado a la realidad del repo:
--   - Tabla real `recurso_turistico` (NO `resources`).
--   - `estado_editorial` en Spanish (NO `publication_status` en English).
--     Valores: 'borrador', 'revision', 'programado', 'publicado', 'archivado'.
--   - `visible_en_mapa` en Spanish (NO `visible_on_map`).
--   - `municipio_id` + tabla `municipio` (NO `municipality_id` + `municipalities`).
--   - `name_es/name_gl/description_es/description_gl` NO son columnas:
--     viven en `traduccion` (entidad_tipo='recurso_turistico',
--     campo='name|description', idioma='es|gl|en|fr|pt'). Se resuelven
--     en la view con JOINs laterales.
--   - `rdf_type` existe desde 001 (schema.org type) y sustituye a
--     `single_type_vocabulary` del prompt template.
--   - Historial editorial vive en `log_cambios` (NO `audit_log`); el
--     actor email se obtiene via `usuario_id → usuario(email)`.
--
-- Los nombres de columnas EN INGLÉS del return table del RPC se mantienen
-- (qualityScore, visible_on_map, etc.) porque el frontend (resources-list.ts)
-- los consume así. El mapeo Spanish→English vive solo dentro del RPC.
--
-- Crea una función que devuelve los recursos con TODOS los campos
-- derivados que el listado necesita en una sola query:
--   - Datos base (id, nombre, tipología, municipio, estado, idiomas)
--   - Flags (visible_on_map, has_coordinates, tiene_traducciones_EN/FR/PT)
--   - Nota de calidad 0-100 (aproximada desde datos disponibles)
--   - PID incompleto (count de campos obligatorios sin rellenar)
--   - Último editor (log_cambios si existe) + fecha
--
-- Incluye filtros facetados como parámetros opcionales y paginación.
-- ==========================================================================


-- 1) Helper: obtener un campo de traducción --------------------------------
-- La función recibe el uuid de la entidad y los filtros campo/idioma.
-- Stable. Usada por la view para name_es/name_gl/desc_es/desc_gl.

create or replace function public.tr_get(
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_campo text,
  p_idioma text
)
returns text
language sql
stable
as $$
  select valor
  from public.traduccion
  where entidad_tipo = p_entidad_tipo
    and entidad_id = p_entidad_id
    and campo = p_campo
    and idioma = p_idioma
  limit 1;
$$;


-- 2) Función que calcula nota de calidad aproximada ------------------------
--
-- Versión simplificada del motor quality-engine.ts (que corre en cliente).
-- Firma por `uuid` para que la view pueda llamarla con el id sin acoplar
-- la función al shape de la view.

create or replace function public.compute_resource_quality_score(
  p_resource_id uuid
)
returns integer
language plpgsql
stable
as $$
declare
  v_score integer := 100;
  v_row public.recurso_turistico%rowtype;
  v_name_es text;
  v_name_gl text;
  v_desc_es text;
  v_desc_gl text;
  v_images_count integer;
  v_images_without_alt integer;
  v_tags_count integer;
begin
  select * into v_row from public.recurso_turistico where id = p_resource_id;
  if not found then return 0; end if;

  v_name_es := public.tr_get('recurso_turistico', p_resource_id, 'name', 'es');
  v_name_gl := public.tr_get('recurso_turistico', p_resource_id, 'name', 'gl');
  v_desc_es := public.tr_get('recurso_turistico', p_resource_id, 'description', 'es');
  v_desc_gl := public.tr_get('recurso_turistico', p_resource_id, 'description', 'gl');

  -- Identificación
  if v_row.rdf_type is null or v_row.rdf_type = '' then v_score := v_score - 15; end if;
  if coalesce(v_name_es, '') = '' then v_score := v_score - 12; end if;
  if coalesce(v_name_gl, '') = '' then v_score := v_score - 5; end if;
  if v_row.municipio_id is null then v_score := v_score - 10; end if;

  -- Contenido
  if coalesce(length(v_desc_es), 0) < 30 then v_score := v_score - 10; end if;
  if coalesce(length(v_desc_gl), 0) < 30 then v_score := v_score - 5; end if;

  -- Ubicación
  if coalesce(v_row.visible_en_mapa, true) and (v_row.latitude is null or v_row.longitude is null) then
    v_score := v_score - 12;
  end if;

  -- Multimedia (tablas del paso 5)
  select count(*), count(*) filter (where alt_text is null or alt_text = '')
    into v_images_count, v_images_without_alt
    from public.resource_images
    where resource_id = p_resource_id;

  if v_images_count = 0 then v_score := v_score - 12; end if;
  if v_images_without_alt > 0 then v_score := v_score - 8; end if;

  -- Clasificación (tags UNE del paso 4)
  select count(*) into v_tags_count
    from public.resource_tags
    where resource_id = p_resource_id
      and tag_key not like 'curaduria-editorial.%';

  if v_tags_count = 0 then v_score := v_score - 10;
  elsif v_tags_count < 3 then v_score := v_score - 5;
  end if;

  -- SEO (paso 6 · migración 024)
  if coalesce(v_row.seo_by_lang->'es'->>'title', '') = '' then v_score := v_score - 5; end if;
  if coalesce(v_row.seo_by_lang->'es'->>'description', '') = '' then v_score := v_score - 5; end if;

  return greatest(0, v_score);
end;
$$;

comment on function public.compute_resource_quality_score(uuid) is
  'Nota aproximada 0-100 de calidad del recurso. Versión SQL simplificada del motor quality-engine.ts (paso 7a). Para uso en listados; el cliente hace cálculo exacto al abrir la ficha.';


-- 3) Función que cuenta campos PID obligatorios sin rellenar ---------------

create or replace function public.count_pid_missing_required(
  p_resource_id uuid
)
returns integer
language plpgsql
stable
as $$
declare
  v_missing integer := 0;
  v_row public.recurso_turistico%rowtype;
  v_name_es text;
begin
  select * into v_row from public.recurso_turistico where id = p_resource_id;
  if not found then return 99; end if;

  v_name_es := public.tr_get('recurso_turistico', p_resource_id, 'name', 'es');

  if v_row.rdf_type is null or v_row.rdf_type = '' then v_missing := v_missing + 1; end if;
  if coalesce(v_name_es, '') = '' then v_missing := v_missing + 1; end if;
  if v_row.municipio_id is null then v_missing := v_missing + 1; end if;

  return v_missing;
end;
$$;

comment on function public.count_pid_missing_required(uuid) is
  'Cuenta campos PID obligatorios sin rellenar: tipología (rdf_type), nombre (ES) y municipio. Si >0, la UI muestra el badge "!" rojo en el listado.';


-- 4) Vista enriquecida -----------------------------------------------------
--
-- Resuelve traducciones name/description para ES/GL/EN/FR/PT + calcula
-- flags de idioma + joinea municipio para obtener el slug + precomputa
-- quality_score y pid_missing_required + last_editor_email.

create or replace view public.resources_list_view as
select
  r.id,
  r.slug,
  r.rdf_type,
  r.municipio_id,
  r.estado_editorial,
  r.visible_en_mapa,
  r.latitude,
  r.longitude,
  r.published_at,
  r.scheduled_publish_at,
  r.created_by,
  r.updated_at,
  r.seo_by_lang,
  r.translations,
  -- Traducciones resueltas (name + description) para ES/GL
  public.tr_get('recurso_turistico', r.id, 'name', 'es') as name_es,
  public.tr_get('recurso_turistico', r.id, 'name', 'gl') as name_gl,
  public.tr_get('recurso_turistico', r.id, 'description', 'es') as description_es,
  public.tr_get('recurso_turistico', r.id, 'description', 'gl') as description_gl,
  -- Flags de idioma: es/gl vienen de traduccion; en/fr/pt del jsonb `translations`
  (coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'es')), 0) > 0) as has_lang_es,
  (coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'gl')), 0) > 0) as has_lang_gl,
  (coalesce(r.translations->'en'->>'name', '') <> '') as has_lang_en,
  (coalesce(r.translations->'fr'->>'name', '') <> '') as has_lang_fr,
  (coalesce(r.translations->'pt'->>'name', '') <> '') as has_lang_pt,
  -- Ubicación
  (r.latitude is not null and r.longitude is not null) as has_coordinates,
  -- Calidad y PID
  public.compute_resource_quality_score(r.id) as quality_score,
  public.count_pid_missing_required(r.id) as pid_missing_required,
  -- Municipio: nombre legible via traducción, fallback al slug
  m.slug as municipio_slug,
  coalesce(
    public.tr_get('municipio', r.municipio_id, 'name', 'es'),
    m.slug
  ) as municipio_name,
  -- Último editor (si log_cambios tiene filas)
  (
    select u.email
    from public.log_cambios lc
    left join public.usuario u on u.id = lc.usuario_id
    where lc.entidad_tipo = 'recurso_turistico'
      and lc.entidad_id = r.id
    order by lc.created_at desc
    limit 1
  ) as last_editor_email
from public.recurso_turistico r
left join public.municipio m on m.id = r.municipio_id;

comment on view public.resources_list_view is
  'Vista enriquecida para el listado SCR-03: resuelve traducciones name/desc desde `traduccion`, flags de idioma, coordenadas, quality_score, PID missing y last_editor_email.';


-- 5) RPC principal: listar con filtros + paginación + orden ----------------
--
-- Return shape en snake_case English para minimizar trabajo en cliente
-- (useResourcesList.ts hace snake_case→camelCase). Las fechas son ISO.
-- `publication_status` devuelve valores Spanish reales del BD
-- ('borrador', 'revision', 'programado', 'publicado', 'archivado').

drop function if exists public.list_resources(
  text, text, text[], uuid[], text[], boolean, boolean, boolean, uuid,
  text, text, integer, integer
);

create or replace function public.list_resources(
  -- Filtros
  p_search text default null,                 -- búsqueda en nombre ES/GL
  p_status text default null,                 -- 'borrador'|'revision'|'programado'|'publicado'|'archivado'
  p_type_keys text[] default null,            -- multi-select rdf_type
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
  total_count bigint
)
language plpgsql
stable
as $$
declare
  v_total bigint;
begin
  -- Primera pasada: contar total (mismos filtros, sin paginación)
  select count(*) into v_total
  from public.resources_list_view r
  where
    (p_search is null or
       r.name_es ilike '%' || p_search || '%' or
       r.name_gl ilike '%' || p_search || '%')
    and (p_status is null or r.estado_editorial = p_status)
    and (p_type_keys is null or r.rdf_type = any(p_type_keys))
    and (p_municipality_ids is null or r.municipio_id = any(p_municipality_ids))
    and (p_visible_on_map is null or coalesce(r.visible_en_mapa, true) = p_visible_on_map)
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

  -- Segunda pasada: devolver página.
  -- Casts a `text`: las columnas `slug`, `rdf_type`, `estado_editorial` y
  -- el `municipio.slug` son VARCHAR(N) en BD, y Postgres distingue
  -- `text` de `varchar(N)` al validar el return table. Casteamos aquí
  -- para evitar "structure of query does not match function result type".
  return query
  select
    r.id,
    r.name_es,
    r.name_gl,
    r.slug::text,
    (r.rdf_type)::text as single_type_vocabulary,
    (r.estado_editorial)::text as publication_status,
    r.municipio_id as municipality_id,
    r.municipio_name::text as municipality_name,
    r.municipio_slug::text as municipality_slug,
    r.has_lang_es, r.has_lang_gl, r.has_lang_en, r.has_lang_fr, r.has_lang_pt,
    r.has_coordinates,
    coalesce(r.visible_en_mapa, true) as visible_on_map,
    r.quality_score,
    r.pid_missing_required,
    r.scheduled_publish_at,
    r.published_at,
    r.updated_at,
    r.last_editor_email,
    v_total as total_count
  from public.resources_list_view r
  where
    (p_search is null or
       r.name_es ilike '%' || p_search || '%' or
       r.name_gl ilike '%' || p_search || '%')
    and (p_status is null or r.estado_editorial = p_status)
    and (p_type_keys is null or r.rdf_type = any(p_type_keys))
    and (p_municipality_ids is null or r.municipio_id = any(p_municipality_ids))
    and (p_visible_on_map is null or coalesce(r.visible_en_mapa, true) = p_visible_on_map)
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
    case when p_order_by = 'municipality' and p_order_dir = 'asc' then r.municipio_name end asc,
    case when p_order_by = 'municipality' and p_order_dir = 'desc' then r.municipio_name end desc,
    case when p_order_by = 'updated_at' and p_order_dir = 'asc' then r.updated_at end asc,
    case when p_order_by = 'updated_at' and p_order_dir = 'desc' then r.updated_at end desc,
    r.updated_at desc  -- fallback
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

comment on function public.list_resources is
  'Lista recursos con filtros facetados, orden configurable y paginación. Los valores de p_status son Spanish (borrador/revision/programado/publicado/archivado). Devuelve total_count en cada fila. SCR-03 fase A.';


-- 6) RPC: estadísticas globales del dashboard KPI --------------------------

drop function if exists public.list_resources_kpis(uuid);

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
    count(*) filter (where estado_editorial = 'publicado')::bigint as published,
    count(*) filter (where estado_editorial = 'programado')::bigint as scheduled,
    count(*) filter (where estado_editorial = 'borrador')::bigint as draft,
    count(*) filter (where estado_editorial = 'archivado')::bigint as archived,
    count(*) filter (where public.count_pid_missing_required(r.id) > 0)::bigint as incomplete_for_publish
  from public.recurso_turistico r
  where p_owner_id is null or r.created_by = p_owner_id;
$$;

comment on function public.list_resources_kpis is
  'KPIs agregados para el dashboard superior del listado. Devuelve contadores en las 4 banderas Spanish reales del CHECK de 001+025. Si p_owner_id se pasa, filtra por creador.';


-- 7) RPC: cambiar estado de un recurso individual --------------------------
--
-- Acepta valores Spanish reales. 'publicado' actualiza published_at y
-- published_by; los otros lo dejan tal cual. Cambiar a cualquier estado
-- distinto de 'programado' limpia scheduled_publish_at.

drop function if exists public.change_resource_status(uuid, text);

create or replace function public.change_resource_status(
  p_resource_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
as $$
begin
  if p_new_status not in ('borrador', 'revision', 'programado', 'publicado', 'archivado') then
    raise exception 'Estado inválido: %', p_new_status;
  end if;

  update public.recurso_turistico
  set estado_editorial = p_new_status,
      published_at = case when p_new_status = 'publicado' then now() else published_at end,
      published_by = case when p_new_status = 'publicado' then auth.uid() else published_by end,
      scheduled_publish_at = case when p_new_status <> 'programado' then null else scheduled_publish_at end
  where id = p_resource_id;
end;
$$;

comment on function public.change_resource_status is
  'Cambia estado_editorial de un recurso. Usado desde el menú "..." del listado para transiciones rápidas sin abrir la ficha. Valores Spanish del CHECK (borrador/revision/programado/publicado/archivado).';

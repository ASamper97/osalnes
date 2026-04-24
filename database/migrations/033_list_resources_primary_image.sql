-- ==========================================================================
-- Migration 033 — Añadir primary_image_path al listado de recursos
-- ==========================================================================
--
-- La migración 026 creó la vista `resources_list_view` y la RPC
-- `list_resources` que alimentan el listado SCR-03. No incluían la imagen
-- principal del recurso porque en aquel momento el paso 5 Multimedia
-- todavía no estaba integrado.
--
-- Ahora el bucket `resource-images` está poblado (1.151 recursos importados
-- desde osalnes.com tras scraping de fotografías de galería). Esta
-- migración añade la columna `primary_image_path` que devuelve el
-- `storage_path` de la imagen marcada `is_primary=true` para cada
-- recurso — alimenta el thumbnail mostrado en la primera columna del
-- listado.
--
-- La URL pública se construye en el cliente:
--   {VITE_SUPABASE_URL}/storage/v1/object/public/resource-images/{storage_path}
-- porque el bucket `resource-images` es public=true.
--
-- Idempotente vía drop+create (la firma del return table cambia).
-- ==========================================================================


-- 1) Vista enriquecida con primary_image_path -----------------------------

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
  public.tr_get('recurso_turistico', r.id, 'name', 'es') as name_es,
  public.tr_get('recurso_turistico', r.id, 'name', 'gl') as name_gl,
  public.tr_get('recurso_turistico', r.id, 'description', 'es') as description_es,
  public.tr_get('recurso_turistico', r.id, 'description', 'gl') as description_gl,
  (coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'es')), 0) > 0) as has_lang_es,
  (coalesce(length(public.tr_get('recurso_turistico', r.id, 'name', 'gl')), 0) > 0) as has_lang_gl,
  (coalesce(r.translations->'en'->>'name', '') <> '') as has_lang_en,
  (coalesce(r.translations->'fr'->>'name', '') <> '') as has_lang_fr,
  (coalesce(r.translations->'pt'->>'name', '') <> '') as has_lang_pt,
  (r.latitude is not null and r.longitude is not null) as has_coordinates,
  public.compute_resource_quality_score(r.id) as quality_score,
  public.count_pid_missing_required(r.id) as pid_missing_required,
  m.slug as municipio_slug,
  coalesce(
    public.tr_get('municipio', r.municipio_id, 'name', 'es'),
    m.slug
  ) as municipio_name,
  (
    select u.email
    from public.log_cambios lc
    left join public.usuario u on u.id = lc.usuario_id
    where lc.entidad_tipo = 'recurso_turistico'
      and lc.entidad_id = r.id
    order by lc.created_at desc
    limit 1
  ) as last_editor_email,
  -- NUEVO: storage_path de la imagen primaria, o fallback al primer
  -- sort_order si no hay ninguna marcada is_primary. NULL si el recurso
  -- no tiene imágenes.
  (
    select ri.storage_path
    from public.resource_images ri
    where ri.resource_id = r.id
    order by ri.is_primary desc, ri.sort_order asc, ri.created_at asc
    limit 1
  ) as primary_image_path
from public.recurso_turistico r
left join public.municipio m on m.id = r.municipio_id;

comment on view public.resources_list_view is
  'Vista enriquecida para el listado SCR-03. Migración 033 añade primary_image_path (fallback a la primera imagen por sort_order si ninguna tiene is_primary=true).';


-- 2) RPC list_resources con la nueva columna ------------------------------

-- Drop obligatorio: la firma del return table cambia → `create or replace`
-- no admite modificar returns.
drop function if exists public.list_resources(
  text, text, text[], uuid[], text[], boolean, boolean, boolean, uuid,
  text, text, integer, integer
);

create or replace function public.list_resources(
  p_search text default null,
  p_status text default null,
  p_type_keys text[] default null,
  p_municipality_ids uuid[] default null,
  p_languages_missing text[] default null,
  p_visible_on_map boolean default null,
  p_has_coordinates boolean default null,
  p_incomplete_for_publish boolean default null,
  p_owner_id uuid default null,
  p_order_by text default 'updated_at',
  p_order_dir text default 'desc',
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
  primary_image_path text,
  total_count bigint
)
language plpgsql
stable
as $$
declare
  v_total bigint;
begin
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
    r.last_editor_email::text,
    r.primary_image_path::text,
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
    r.updated_at desc
  limit p_page_size
  offset (p_page - 1) * p_page_size;
end;
$$;

comment on function public.list_resources is
  'Lista recursos con filtros/orden/paginación. Migración 033 añade primary_image_path para thumbnail en el listado.';

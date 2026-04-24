-- ==========================================================================
-- Migration 033 — DOWN: restaurar firma y vista previa a la 026
-- ==========================================================================

drop function if exists public.list_resources(
  text, text, text[], uuid[], text[], boolean, boolean, boolean, uuid,
  text, text, integer, integer
);

-- Re-crear la vista sin primary_image_path (copia de la 026).
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
  ) as last_editor_email
from public.recurso_turistico r
left join public.municipio m on m.id = r.municipio_id;

-- No re-creamos la RPC 026 aquí porque la migración 026.sql ya lo hace
-- idempotentemente; basta con ejecutarla de nuevo para restaurar.

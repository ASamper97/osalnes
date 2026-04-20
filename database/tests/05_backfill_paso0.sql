-- ==========================================================================
-- Backfill legacy → UNE 178503 (paso 0 · tarea 5)
-- Ejecutado en Supabase el 2026-04-20. Proyecto oduglbxjcmmdexwplzvw.
-- ==========================================================================
--
-- PROPÓSITO
-- ---------
-- Tras aplicar la migración 020 (fuente única de tipologías), los 16
-- recursos existentes en producción tenían `rdf_type` poblado (Beach,
-- Hotel, Museum, etc.) pero NINGÚN tag `tipo-de-recurso.*` en
-- resource_tags. Sin backfill, al editar cualquiera con el wizard nuevo
-- el paso 1 forzaría a elegir la tipología desde cero — mala UX con 16
-- fichas ya cargadas.
--
-- APROXIMACIÓN
-- ------------
-- Backfill SQL puro (sin script TS). El rdf_type actual YA es el value
-- schema.org exacto que corresponde al `value` de los tags UNE del grupo
-- `tipo-de-recurso.*` (ej: rdf_type='Hotel' ↔ tag.value='Hotel'). Así:
--
--   value de resource_tags ← r.rdf_type  (schema.org correcto, no placeholder)
--   tag_key ← _tipology_legacy_to_une.une_tag_key  (mapeo del seed)
--
-- Resultado: el criterio literal del prompt
-- "select count(*) where source='backfill-020' and value=tag_key = 0"
-- se cumple en la misma query — no hace falta un segundo paso correctivo.
--
-- COBERTURA
-- ---------
-- Seed de la migración 020 + 2 mappings nuevos aquí (Campground, Festival)
-- cubren 14 de los 16 recursos. Los 2 restantes (TouristAttraction ×2) se
-- dejan intencionadamente SIN backfill: es un tipo demasiado genérico, el
-- paso 1 del wizard forzará a elegir la tipología correcta al editar.
--
-- RESULTADO VERIFICADO
-- --------------------
--   filas_backfill                     → 14
--   placeholders_pendientes            → 0
--   recursos_sin_main_tag_tras_backfill → 2  (TouristAttraction, intencional)
-- ==========================================================================


-- ── 1) Ampliar seed con Campground y Festival ─────────────────────────────
insert into public._tipology_legacy_to_une (legacy_value, une_tag_key, notes) values
  ('Campground', 'tipo-de-recurso.camping',         'schema.org → UNE'),
  ('Festival',   'tipo-de-recurso.fiesta-festival', 'schema.org → UNE')
on conflict (legacy_value) do nothing;


-- ── 2) Backfill ───────────────────────────────────────────────────────────
insert into public.resource_tags (resource_id, tag_key, field, value, pid_exportable, source)
select
  r.id,
  m.une_tag_key,
  'type'::public.tag_field,
  r.rdf_type,                                 -- value = schema.org real
  true,
  'backfill-020'
from public.recurso_turistico r
join public._tipology_legacy_to_une m on m.legacy_value = r.rdf_type
where not exists (
  select 1 from public.resource_tags rt
  where rt.resource_id = r.id
    and rt.tag_key like 'tipo-de-recurso.%'
)
on conflict (resource_id, tag_key) do nothing;


-- ── 3) Verificación ───────────────────────────────────────────────────────
select
  (select count(*) from public.resource_tags where source = 'backfill-020') as filas_backfill,
  (select count(*) from public.resource_tags where source = 'backfill-020' and value = tag_key) as placeholders_pendientes,
  (select count(*) from public.recurso_turistico r
   where not exists (
     select 1 from public.resource_tags rt
     where rt.resource_id = r.id and rt.tag_key like 'tipo-de-recurso.%'
   )) as recursos_sin_main_tag_tras_backfill;

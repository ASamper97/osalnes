-- ==========================================================================
-- Test E2E — migración 018 · vista v_resource_pid_tags
-- Origen: guía-burros v2, Tarea 9.
-- ==========================================================================
--
-- PROPÓSITO
-- ---------
-- Valida que la infraestructura añadida por la migración 018
-- (`database/migrations/018_resource_tags.sql`) sirve correctamente el
-- contrato que consumirá el exportador PID:
--
--   * Tabla `resource_tags` con PK compuesta (resource_id, tag_key).
--   * Enum `tag_field` con los 8 campos PID.
--   * Vista `v_resource_pid_tags` que une recurso → etiqueta → campo.
--   * FK con `on delete cascade` (basta con borrar el recurso).
--
-- Es el mismo camino que recorre el wizard al guardar desde
-- `packages/cms/src/lib/resource-tags.ts::saveResourceTags` (Tarea 6): delete
-- en masa + insert con filas precomputadas en cliente desde TAGS_BY_KEY.
--
-- CÓMO EJECUTARLO
-- ---------------
-- Copiar las 3 secciones (FIXTURE / VERIFY / CLEANUP) al SQL Editor de
-- Supabase (dashboard) y ejecutarlas en orden. Es seguro re-ejecutar: el
-- CLEANUP al final deja la BD como estaba.
--
-- RESULTADO ESPERADO (6 filas, ordenadas por field, tag_key)
-- ----------------------------------------------------------
--   addressLocality | municipio.sanxenxo                | "Sanxenxo"
--   amenityFeature  | comodidades-hab.wifi              | "wifi"
--   amenityFeature  | instalaciones.piscina-climatizada | "indoorPool"
--   amenityFeature  | serv-alojamiento.aparcamiento     | "parking"
--   amenityFeature  | serv-alojamiento.wifi             | "wifi"
--   type            | tipo-de-recurso.hotel             | Hotel
--
-- Criterio del prompt: ≥1 fila con field='type'+value='Hotel' y ≥1 con
-- field='addressLocality'+value='"Sanxenxo"'. Verificado 2026-04-19.
-- ==========================================================================


-- ── 1) FIXTURE ─────────────────────────────────────────────────────────────
insert into public.recurso_turistico (uri, rdf_type, slug, estado_editorial)
values (
  'urn:test:test-hotel-integracion',
  'Hotel',
  'test-hotel-integracion',
  'borrador'
);

insert into public.resource_tags (resource_id, tag_key, field, value, pid_exportable, source)
select r.id, t.tag_key, t.field::public.tag_field, t.value, t.pid_exportable, 'manual'
from public.recurso_turistico r
cross join (values
  ('tipo-de-recurso.hotel',             'type',            'Hotel',         true),
  ('municipio.sanxenxo',                'addressLocality', '"Sanxenxo"',    true),
  ('serv-alojamiento.wifi',             'amenityFeature',  '"wifi"',        true),
  ('serv-alojamiento.aparcamiento',     'amenityFeature',  '"parking"',     true),
  ('instalaciones.piscina-climatizada', 'amenityFeature',  '"indoorPool"',  true),
  ('comodidades-hab.wifi',              'amenityFeature',  '"wifi"',        true)
) as t(tag_key, field, value, pid_exportable)
where r.slug = 'test-hotel-integracion';


-- ── 2) VERIFY ──────────────────────────────────────────────────────────────
select field, tag_key, value
from public.v_resource_pid_tags
where resource_slug = 'test-hotel-integracion'
order by field, tag_key;


-- ── 3) CLEANUP ─────────────────────────────────────────────────────────────
-- La FK resource_tags.resource_id ON DELETE CASCADE elimina las 6 filas
-- de tags asociadas, así que basta con borrar el recurso.
delete from public.recurso_turistico where slug = 'test-hotel-integracion';

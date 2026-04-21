-- ==========================================================================
-- Migration 022 · ROLLBACK
-- ==========================================================================
--
-- ATENCIÓN: el rollback del rename curaduria-editorial → destacados
-- funciona solo si no se ha añadido ningún tag NUEVO en el grupo
-- curaduria-editorial que no existiera originalmente en destacados.
-- En desarrollo es seguro; en producción valorar primero.
-- ==========================================================================

-- 1) Deshacer rename
update public.resource_tags
set tag_key = replace(tag_key, 'curaduria-editorial.', 'destacados.')
where tag_key like 'curaduria-editorial.%';

-- 2) Quitar índices
drop index if exists idx_resources_serves_cuisine;
drop index if exists idx_resources_accommodation_rating;

-- 3) Quitar constraint
alter table public.recurso_turistico
  drop constraint if exists resources_accommodation_rating_range;

-- 4) Quitar columnas (PÉRDIDA DE DATOS)
alter table public.recurso_turistico drop column if exists serves_cuisine;
alter table public.recurso_turistico drop column if exists occupancy;
alter table public.recurso_turistico drop column if exists accommodation_rating;

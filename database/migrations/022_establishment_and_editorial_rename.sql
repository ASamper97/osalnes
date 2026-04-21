-- ==========================================================================
-- Migration 022 — Datos de establecimiento + rename curaduría editorial (paso 4)
-- ==========================================================================
--
-- Cambios:
--
--   1. Añadir columnas estructuradas para datos de establecimiento:
--      - accommodation_rating (integer) — estrellas/tenedores/categoría
--      - occupancy (integer) — aforo máximo
--      - serves_cuisine (text[]) — códigos UNE de tipos de cocina
--
--   2. Renombrar grupo de tags "destacados" → "curaduria-editorial" en
--      la tabla de tags asignados a recursos (decisión 3-B del usuario).
--
-- Idempotente con `if not exists` y `do $$ ... $$`. Se puede ejecutar
-- varias veces sin efectos laterales.
-- ==========================================================================


-- 1) Columnas nuevas de establecimiento --------------------------------------

do $$
begin
  -- Clasificación oficial (estrellas/tenedores/categoría)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'resources'
      and column_name = 'accommodation_rating'
  ) then
    alter table public.resources add column accommodation_rating integer;
    comment on column public.resources.accommodation_rating is
      'Clasificación oficial: 1-5 estrellas (hoteles), 1-5 tenedores (restaurantes), 1-3 categoría (otros). NULL = sin clasificar. Se mapea a schema.org accommodationRating para hoteles.';
  end if;

  -- Aforo (occupancy)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'resources'
      and column_name = 'occupancy'
  ) then
    alter table public.resources add column occupancy integer;
    comment on column public.resources.occupancy is
      'Aforo máximo en personas. Se mapea a schema.org occupancy.';
  end if;

  -- Tipos de cocina como array de códigos UNE
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'resources'
      and column_name = 'serves_cuisine'
  ) then
    alter table public.resources add column serves_cuisine text[] not null default '{}';
    comment on column public.resources.serves_cuisine is
      'Array de códigos UNE 178503 §7.7 (SPANISH, FISH AND SEAFOOD, TAPAS, etc.). Se mapea a schema.org servesCuisine. Solo aplica a restaurantes y bodegas.';
  end if;
end $$;


-- 2) Constraint de rango en accommodation_rating -----------------------------
--
-- Evita valores fuera de rango. 1-5 cubre estrellas (1-5), tenedores (1-5)
-- y categoría (1-3). Permitimos NULL (sin clasificar).

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'resources'
      and constraint_name = 'resources_accommodation_rating_range'
  ) then
    alter table public.resources
      add constraint resources_accommodation_rating_range
      check (accommodation_rating is null or (accommodation_rating between 1 and 5));
  end if;
end $$;


-- 3) Índices sobre los nuevos campos -----------------------------------------

create index if not exists idx_resources_accommodation_rating
  on public.resources (accommodation_rating)
  where accommodation_rating is not null;

create index if not exists idx_resources_serves_cuisine
  on public.resources using gin (serves_cuisine);


-- 4) Rename grupo "destacados" → "curaduria-editorial" en resource_tags -----
--
-- Actualiza las claves existentes que empiezan por "destacados." para que
-- usen el nuevo prefijo. Idempotente: si se ejecuta dos veces, la segunda
-- no encuentra filas que modificar.

do $$
declare
  affected_rows integer;
begin
  update public.resource_tags
  set tag_key = replace(tag_key, 'destacados.', 'curaduria-editorial.')
  where tag_key like 'destacados.%';

  get diagnostics affected_rows = row_count;
  raise notice 'Migración 022: % filas de resource_tags actualizadas (destacados → curaduria-editorial)', affected_rows;
end $$;


-- 5) Documentación ----------------------------------------------------------

comment on table public.resources is
  'Recursos turísticos. Modelo alineado con UNE 178503. Las columnas accommodation_rating, occupancy y serves_cuisine solo aplican a ciertas tipologías (ver packages/shared/src/data/establishment-fields.ts).';

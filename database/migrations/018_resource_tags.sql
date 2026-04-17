-- ==========================================================================
-- Migration 018 — Resource tags (catálogo UNE 178503)
-- ==========================================================================
--
-- WHY
-- ---
-- El wizard de recursos ("Guía Burros") usaba un desplegable plano con unos
-- pocos tipos de turismo UNE. Esto es insuficiente: el vocabulario oficial
-- de la UNE 178503 define 154 etiquetas repartidas en 18 grupos semánticos y
-- 7 campos PID distintos (type, touristType, amenityFeature, accessibility,
-- addressLocality, cuisine, editorial). Esta migración añade la persistencia
-- estructurada de esas etiquetas para:
--
--   * Alimentar el selector contextual del paso 4 del wizard
--   * Exportar a PID / Data Lake con cero ambigüedad
--   * Permitir scoring de completitud semántica en el paso 7
--   * Preparar el import masivo de los 1151 recursos del xlsx O Salnés
--
-- Fuente de verdad del catálogo: packages/shared/src/data/tag-catalog.ts
-- ==========================================================================

-- 1) Campos nuevos en recurso_turistico ------------------------------------
-- Nota: la tabla de recursos se llama `recurso_turistico` en este schema
-- (ver 001_initial_schema.sql:87). Los nombres de columnas legacy que añade
-- esta migración se mantienen en inglés para alinearse con el exportador PID.
alter table public.recurso_turistico
  add column if not exists xlsx_tipo_original text,
  add column if not exists review_required   boolean not null default false,
  add column if not exists imported_from     text,
  add column if not exists imported_at       timestamptz;

comment on column public.recurso_turistico.xlsx_tipo_original is
  'Valor original de la columna Tipo en el xlsx de importación (trazabilidad)';
comment on column public.recurso_turistico.review_required is
  'Marcado cuando el mapping automático no es exacto y requiere revisión editorial';
comment on column public.recurso_turistico.imported_from is
  'Identificador de la fuente de import (p. ej. xlsx_osalnes_v1, manual)';


-- 2) Enum de campos PID ----------------------------------------------------
do $$ begin
  create type public.tag_field as enum (
    'type',
    'touristType',
    'amenityFeature',
    'accessibility',
    'addressLocality',
    'cuisine',
    'editorial',
    'cms'
  );
exception when duplicate_object then null; end $$;


-- 3) Tabla pivote de etiquetas --------------------------------------------
create table if not exists public.resource_tags (
  resource_id     uuid              not null references public.recurso_turistico(id) on delete cascade,
  tag_key         text              not null,   -- '{groupKey}.{tagSlug}' — tag-catalog.ts
  field           public.tag_field  not null,   -- redundante con catálogo, evita joins en export
  value           text              not null,   -- valor raw a exportar (Beach, Hotel, 'wifi', ...)
  pid_exportable  boolean           not null default true,
  source          text              not null default 'manual',  -- 'manual' | 'import' | 'ai-categorize'
  created_at      timestamptz       not null default now(),
  primary key (resource_id, tag_key)
);

comment on table public.resource_tags is
  'Etiquetas UNE 178503 asociadas a cada recurso. Fuente de verdad del catálogo: packages/shared/src/data/tag-catalog.ts';


-- 4) Índices de consulta ---------------------------------------------------
create index if not exists resource_tags_resource_idx on public.resource_tags (resource_id);
create index if not exists resource_tags_field_idx    on public.resource_tags (field) where pid_exportable = true;
create index if not exists resource_tags_tag_idx      on public.resource_tags (tag_key);


-- 5) Vista para el export PID ---------------------------------------------
create or replace view public.v_resource_pid_tags as
  select
    r.id    as resource_id,
    r.slug  as resource_slug,
    rt.field,
    rt.tag_key,
    rt.value
  from public.recurso_turistico r
  join public.resource_tags rt on rt.resource_id = r.id
  where rt.pid_exportable = true;


-- 6) RLS -------------------------------------------------------------------
-- Mismo modelo que `recurso_turistico`: anónimo lee solo publicados, editor
-- autenticado lee/escribe todo. El baseline de 010 deja RLS activado sin
-- policies (deny-all), igual que recurso_turistico, así que esta policy solo
-- tiene efecto si en el futuro se abre acceso anon a recurso_turistico.
alter table public.resource_tags enable row level security;

drop policy if exists resource_tags_read_public on public.resource_tags;
drop policy if exists resource_tags_rw_authed   on public.resource_tags;

create policy resource_tags_read_public on public.resource_tags
  for select using (
    exists (
      select 1 from public.recurso_turistico r
      where r.id = resource_tags.resource_id
        and r.estado_editorial = 'publicado'
    )
  );

create policy resource_tags_rw_authed on public.resource_tags
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- 7) Helper: completitud semántica PID por recurso ------------------------
-- Alimenta la tarjeta "Completitud PID" del paso 7 del wizard.
create or replace function public.resource_pid_completeness(p_resource_id uuid)
returns table (
  field           public.tag_field,
  tag_count       integer,
  pid_exportable  integer
) language sql stable as $$
  select
    rt.field,
    count(*)::int                                   as tag_count,
    count(*) filter (where rt.pid_exportable)::int  as pid_exportable
  from public.resource_tags rt
  where rt.resource_id = p_resource_id
  group by rt.field;
$$;

comment on function public.resource_pid_completeness is
  'Resumen de etiquetas PID por campo para un recurso — alimenta la tarjeta de completitud en el wizard.';

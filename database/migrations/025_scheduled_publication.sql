-- ==========================================================================
-- Migration 025 — Publicación programada + auditoría de publicación (7b)
-- ==========================================================================
--
-- Cambios:
--
--   1. estado_editorial: CHECK existente ampliado con 'programado'
--   2. scheduled_publish_at timestamptz — cuándo publicar automáticamente
--   3. published_at timestamptz — YA EXISTÍA en 001; guard idempotente
--   4. published_by uuid — quién lo publicó (NULL si lo publicó el cron)
--   5. RPC publish_scheduled_resources() — llamado por pg_cron (o Edge
--      Function de fallback) cada 15 minutos; publica los programados
--      vencidos.
--
-- Adaptado a la realidad del repo:
--   - Tabla real es `recurso_turistico` (NO `resources`; error recurrente
--     de los prompts de rediseño).
--   - La columna de estado editorial es `estado_editorial` en español,
--     con CHECK ('borrador', 'revision', 'publicado', 'archivado') desde
--     la migración 001. Añadimos 'programado' a ese CHECK.
--
-- Idempotente.
-- ==========================================================================


-- 1) Ampliar CHECK de estado_editorial con 'programado' -------------------

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='recurso_turistico'
      and constraint_name='recurso_turistico_estado_editorial_check'
  ) then
    alter table public.recurso_turistico drop constraint recurso_turistico_estado_editorial_check;
  end if;

  alter table public.recurso_turistico
    add constraint recurso_turistico_estado_editorial_check
    check (estado_editorial in ('borrador', 'revision', 'programado', 'publicado', 'archivado'));
end $$;


-- 2) Columnas nuevas ------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='recurso_turistico' and column_name='scheduled_publish_at'
  ) then
    alter table public.recurso_turistico add column scheduled_publish_at timestamptz;
    comment on column public.recurso_turistico.scheduled_publish_at is
      'Fecha/hora en que el recurso debe publicarse automáticamente. NULL si no está programado. El cron publish-scheduled lo mira cada 15 min.';
  end if;

  -- `published_at` ya existe desde 001; este IF sirve para repos que
  -- pudieran haberla borrado en el camino.
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='recurso_turistico' and column_name='published_at'
  ) then
    alter table public.recurso_turistico add column published_at timestamptz;
  end if;
  comment on column public.recurso_turistico.published_at is
    'Fecha/hora real en la que el recurso pasó a estado publicado. Distinta de scheduled_publish_at si hubo retrasos del cron.';

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='recurso_turistico' and column_name='published_by'
  ) then
    alter table public.recurso_turistico add column published_by uuid references auth.users(id) on delete set null;
    comment on column public.recurso_turistico.published_by is
      'Quién publicó el recurso. NULL si lo publicó el sistema (cron de programados).';
  end if;
end $$;


-- 3) Consistencia: scheduled_publish_at solo con estado 'programado' ------

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='recurso_turistico'
      and constraint_name='recurso_turistico_scheduled_publish_at_coherent'
  ) then
    alter table public.recurso_turistico
      add constraint recurso_turistico_scheduled_publish_at_coherent
      check (
        (estado_editorial = 'programado' and scheduled_publish_at is not null)
        or (estado_editorial <> 'programado')
      );
  end if;
end $$;


-- 4) Índice para el cron (busca rápido los vencidos) ----------------------

create index if not exists idx_recurso_turistico_scheduled_pending
  on public.recurso_turistico (scheduled_publish_at)
  where estado_editorial = 'programado';


-- 5) RPC publish_scheduled_resources() ------------------------------------
--
-- Llamado desde pg_cron (opción A elegida) cada 15 minutos. Devuelve
-- cuántos recursos publicó. SECURITY DEFINER para que pueda actualizar
-- sin estar autenticado como un usuario concreto. El Edge Function
-- `publish-scheduled` queda disponible como fallback sin desplegar.

create or replace function public.publish_scheduled_resources()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  with to_publish as (
    select id
    from public.recurso_turistico
    where estado_editorial = 'programado'
      and scheduled_publish_at is not null
      and scheduled_publish_at <= now()
    for update skip locked
  )
  update public.recurso_turistico r
  set estado_editorial = 'publicado',
      published_at = now(),
      published_by = null,  -- null = publicado por el sistema (cron)
      scheduled_publish_at = null
  from to_publish
  where r.id = to_publish.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.publish_scheduled_resources() is
  'Publica todos los recursos en estado programado cuya fecha ya venció. Llamado por pg_cron cada 15 min. Devuelve el número de recursos publicados.';

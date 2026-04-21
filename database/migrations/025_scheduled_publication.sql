-- ==========================================================================
-- Migration 025 — Publicación programada + auditoría de publicación (7b)
-- ==========================================================================
--
-- Cambios:
--
--   1. publication_status: enum existente ampliado con 'scheduled'
--   2. scheduled_publish_at timestamptz — cuándo publicar automáticamente
--   3. published_at timestamptz — cuándo se publicó de hecho
--   4. published_by uuid — quién lo publicó (o el sistema si cron)
--   5. RPC publish_scheduled_resources() — se llama desde el Edge Function
--      cron cada 15 minutos y publica los programados vencidos.
--
-- Asume que `resources.publication_status` ya existe. Si no, la migración
-- crea el constraint.
--
-- Idempotente.
-- ==========================================================================


-- 1) Ampliar publication_status -----------------------------------------
--
-- Si existe como text con CHECK, hay que recrear el CHECK con 'scheduled'.
-- Si existe como ENUM, hay que añadir el valor al enum.

do $$
begin
  -- Caso A: publication_status es text con CHECK
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='publication_status'
      and data_type='text'
  ) then
    -- Borrar el check viejo si existe y recrear con 'scheduled' incluido
    if exists (
      select 1 from information_schema.table_constraints
      where table_schema='public' and table_name='resources'
        and constraint_name='resources_publication_status_check'
    ) then
      alter table public.resources drop constraint resources_publication_status_check;
    end if;

    alter table public.resources
      add constraint resources_publication_status_check
      check (publication_status in ('draft', 'scheduled', 'published', 'archived'));
  end if;

  -- Caso B: es un enum (comprobar y añadir valor si no existe)
  if exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where t.typname='publication_status_enum' and n.nspname='public'
  ) then
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid=e.enumtypid
      where t.typname='publication_status_enum' and e.enumlabel='scheduled'
    ) then
      alter type public.publication_status_enum add value if not exists 'scheduled';
    end if;
  end if;
end $$;


-- 2) Columnas nuevas ----------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='scheduled_publish_at'
  ) then
    alter table public.resources add column scheduled_publish_at timestamptz;
    comment on column public.resources.scheduled_publish_at is
      'Fecha/hora en que el recurso debe publicarse automáticamente. NULL si no está programado. El cron publish-scheduled lo mira cada 15 min.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='published_at'
  ) then
    alter table public.resources add column published_at timestamptz;
    comment on column public.resources.published_at is
      'Fecha/hora real en la que el recurso pasó a estado published. Distinta de scheduled_publish_at si hubo retrasos del cron.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='published_by'
  ) then
    alter table public.resources add column published_by uuid references auth.users(id) on delete set null;
    comment on column public.resources.published_by is
      'Quién publicó el recurso. NULL si lo publicó el sistema (cron de programados).';
  end if;
end $$;


-- 3) Consistencia: scheduled_publish_at solo tiene sentido si status='scheduled'

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='resources'
      and constraint_name='resources_scheduled_publish_at_coherent'
  ) then
    alter table public.resources
      add constraint resources_scheduled_publish_at_coherent
      check (
        (publication_status = 'scheduled' and scheduled_publish_at is not null)
        or (publication_status <> 'scheduled')
      );
  end if;
end $$;


-- 4) Índice para el cron (busca rapido los vencidos) --------------------

create index if not exists idx_resources_scheduled_pending
  on public.resources (scheduled_publish_at)
  where publication_status = 'scheduled';


-- 5) RPC publish_scheduled_resources() ----------------------------------
--
-- Llamado desde el Edge Function cron cada 15 minutos. Devuelve cuántos
-- recursos publicó. SECURITY DEFINER para que el cron pueda actualizar
-- aunque no esté autenticado como un usuario concreto.

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
    from public.resources
    where publication_status = 'scheduled'
      and scheduled_publish_at is not null
      and scheduled_publish_at <= now()
    for update skip locked
  )
  update public.resources r
  set publication_status = 'published',
      published_at = now(),
      published_by = null,  -- null = publicado por el sistema
      scheduled_publish_at = null
  from to_publish
  where r.id = to_publish.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.publish_scheduled_resources() is
  'Publica todos los recursos en estado scheduled cuya fecha ya venció. Llamado por el Edge Function cron publish-scheduled cada 15 min. Devuelve el número de recursos publicados.';

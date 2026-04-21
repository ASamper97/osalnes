-- ==========================================================================
-- Migration 025 · ROLLBACK
-- ==========================================================================
--
-- Notas:
--   - Si scheduled_publish_at tiene datos, se pierden.
--   - Si hay recursos en estado 'programado', se pasan a 'borrador' antes.
--   - `published_at` venía de migración 001: NO lo tocamos aquí para no
--     perder datos históricos de recursos publicados. Solo borramos las
--     columnas que esta migración introdujo.
-- ==========================================================================

-- 1) Reclasificar los 'programado' como 'borrador' para no dejar estado huérfano
update public.recurso_turistico
set estado_editorial = 'borrador', scheduled_publish_at = null
where estado_editorial = 'programado';

-- 2) Quitar RPC
drop function if exists public.publish_scheduled_resources();

-- 3) Quitar índice
drop index if exists idx_recurso_turistico_scheduled_pending;

-- 4) Quitar constraint de coherencia
alter table public.recurso_turistico
  drop constraint if exists recurso_turistico_scheduled_publish_at_coherent;

-- 5) Quitar columnas nuevas (PÉRDIDA DE DATOS en las que 025 creó)
alter table public.recurso_turistico drop column if exists published_by;
alter table public.recurso_turistico drop column if exists scheduled_publish_at;
-- published_at NO se borra: existía desde 001.

-- 6) Recrear CHECK estado_editorial sin 'programado'
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
    check (estado_editorial in ('borrador', 'revision', 'publicado', 'archivado'));
end $$;

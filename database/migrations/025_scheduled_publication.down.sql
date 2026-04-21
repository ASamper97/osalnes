-- ==========================================================================
-- Migration 025 · ROLLBACK
-- ==========================================================================
--
-- Notas:
--   - Si scheduled_publish_at tiene datos, se pierden.
--   - Si hay recursos en estado 'scheduled', se pasan a 'draft' antes.
-- ==========================================================================

-- 1) Reclasificar los 'scheduled' como 'draft' para no dejar status huérfanos
update public.resources
set publication_status = 'draft', scheduled_publish_at = null
where publication_status = 'scheduled';

-- 2) Quitar RPC
drop function if exists public.publish_scheduled_resources();

-- 3) Quitar índice
drop index if exists idx_resources_scheduled_pending;

-- 4) Quitar constraint coherencia
alter table public.resources
  drop constraint if exists resources_scheduled_publish_at_coherent;

-- 5) Quitar columnas (PÉRDIDA DE DATOS)
alter table public.resources drop column if exists published_by;
alter table public.resources drop column if exists published_at;
alter table public.resources drop column if exists scheduled_publish_at;

-- 6) Recrear CHECK publication_status sin 'scheduled' (si existía como text)
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='resources'
      and constraint_name='resources_publication_status_check'
  ) then
    alter table public.resources drop constraint resources_publication_status_check;
    alter table public.resources
      add constraint resources_publication_status_check
      check (publication_status in ('draft', 'published', 'archived'));
  end if;
end $$;

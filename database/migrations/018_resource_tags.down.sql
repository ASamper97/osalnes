-- ==========================================================================
-- Migration 018 — Resource tags · ROLLBACK
-- ==========================================================================
--
-- Deshace lo que hace 018_resource_tags.sql en orden inverso. Seguro de
-- ejecutar aunque la migración up se haya aplicado parcialmente.
-- ==========================================================================

-- 7) Función de completitud
drop function if exists public.resource_pid_completeness(uuid);

-- 6) RLS: borrar policies (la tabla se borra después)
drop policy if exists resource_tags_read_public on public.resource_tags;
drop policy if exists resource_tags_rw_authed   on public.resource_tags;

-- 5) Vista de export
drop view if exists public.v_resource_pid_tags;

-- 4/3) Tabla pivote (y sus índices por cascade)
drop table if exists public.resource_tags;

-- 2) Enum (solo se borra si no hay nada que lo referencie — la tabla ya se dropeó)
drop type if exists public.tag_field;

-- 1) Columnas nuevas en resources
alter table public.resources
  drop column if exists imported_at,
  drop column if exists imported_from,
  drop column if exists review_required,
  drop column if exists xlsx_tipo_original;

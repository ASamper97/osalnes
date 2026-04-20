-- ==========================================================================
-- Migration 019 — usuario.municipio_id (guía-burros rediseño · Lote 3b)
-- ==========================================================================
--
-- WHY
-- ---
-- El listado de Recursos del CMS tiene filtro por municipio (Lote 1 del
-- rediseño), pero la experiencia de un editor de Cambados es: entrar, ver
-- todo O Salnés, y tener que elegir "Cambados" manualmente cada vez. Con
-- esta columna cada usuario puede tener asignado un municipio "por defecto"
-- y el filtro viene preseleccionado al entrar — el editor ve "lo suyo"
-- directamente.
--
-- Es NULLABLE a propósito:
--   * Admins y perfiles de Analítica/Técnico no suelen estar ligados a un
--     solo municipio.
--   * Usuarios creados antes de esta migración quedan con NULL → se
--     comportan como hoy (ven todos los municipios).
--
-- También habilita filtrar recursos por "lo que yo creé" (created_by) desde
-- la edge function /resources, que es ortogonal a esta columna pero entra
-- en el mismo lote del rediseño por coherencia funcional.
-- ==========================================================================

alter table public.usuario
  add column if not exists municipio_id uuid references public.municipio(id) on delete set null;

comment on column public.usuario.municipio_id is
  'Municipio asignado por defecto al usuario (editor local). NULL para admins/analítica. Alimenta el filtro preseleccionado en el listado de Recursos.';

create index if not exists usuario_municipio_idx on public.usuario (municipio_id)
  where municipio_id is not null;

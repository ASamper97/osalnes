-- ==========================================================================
-- Migration 019 — usuario.municipio_id · ROLLBACK
-- ==========================================================================

drop index if exists public.usuario_municipio_idx;

alter table public.usuario
  drop column if exists municipio_id;

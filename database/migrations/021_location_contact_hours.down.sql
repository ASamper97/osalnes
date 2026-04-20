-- ==========================================================================
-- Migration 021 — Ubicación, contacto y horarios · ROLLBACK
-- ==========================================================================
--
-- Elimina las columnas y artefactos introducidos por 021_location_contact_hours.sql
--
-- ATENCIÓN: si ya hay recursos con datos en esas columnas, el rollback
-- provoca pérdida de información. Solo usar en desarrollo o tras
-- backfill completo a otra tabla.
-- ==========================================================================

-- Vista
drop view if exists public.v_resources_geolocated;

-- Índices
drop index if exists idx_resources_latlng;
drop index if exists idx_resources_opening_hours_kind;
drop index if exists idx_resources_social_links;

-- Columnas (ver nota de pérdida de datos arriba)
alter table public.resources drop column if exists opening_hours_plan;
alter table public.resources drop column if exists social_links;
alter table public.resources drop column if exists contact_web;
alter table public.resources drop column if exists contact_email;
alter table public.resources drop column if exists contact_phone;
alter table public.resources drop column if exists parroquia_text;
alter table public.resources drop column if exists locality;
alter table public.resources drop column if exists postal_code;
alter table public.resources drop column if exists street_address;

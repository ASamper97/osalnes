-- ==========================================================================
-- Migration 024 — SEO estructurado + indexación + Open Graph (paso 6)
-- ==========================================================================
--
-- Cambios:
--
--   1. seo_by_lang JSONB — título + descripción por idioma ({es:{...}, gl:{...}})
--   2. translations JSONB — traducciones adicionales EN/FR/PT
--   3. keywords text[] — palabras clave
--   4. indexable boolean — control de meta robots (default true)
--   5. og_image_override_path text — null = usar imagen principal del paso 5
--   6. canonical_url text — opcional, solo admin
--   7. Índice único parcial para slug (si no lo hay ya)
--
-- El campo `slug` se asume que ya existe en la tabla `resources` desde
-- migraciones anteriores. Si no existe, añadirlo con esta migración.
--
-- Idempotente.
-- ==========================================================================


-- 1) Columnas nuevas --------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='seo_by_lang'
  ) then
    alter table public.resources add column seo_by_lang jsonb not null default '{}'::jsonb;
    comment on column public.resources.seo_by_lang is
      'SEO por idioma: {es:{title,description}, gl:{...}, en:{...}, fr:{...}, pt:{...}}. Se mapea a meta title/description y og:title/og:description.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='translations'
  ) then
    alter table public.resources add column translations jsonb not null default '{}'::jsonb;
    comment on column public.resources.translations is
      'Traducciones adicionales EN/FR/PT del nombre y descripción corta. {en:{name,description}, fr:{...}, pt:{...}}. No incluye ES/GL (son idiomas base).';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='keywords'
  ) then
    alter table public.resources add column keywords text[] not null default '{}';
    comment on column public.resources.keywords is
      'Palabras clave del recurso. Se usan para el buscador interno y como meta keywords (aunque Google las ignora).';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='indexable'
  ) then
    alter table public.resources add column indexable boolean not null default true;
    comment on column public.resources.indexable is
      'Si es false, la web pública renderiza <meta name="robots" content="noindex,nofollow">. Default true.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='og_image_override_path'
  ) then
    alter table public.resources add column og_image_override_path text;
    comment on column public.resources.og_image_override_path is
      'Path en Storage bucket resource-images de una imagen específica para compartir en redes. Si es NULL, se usa la imagen principal del paso 5 (resource_images con is_primary=true).';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='canonical_url'
  ) then
    alter table public.resources add column canonical_url text;
    comment on column public.resources.canonical_url is
      'URL canónica opcional. Si se rellena, la web pública la usa como <link rel="canonical">. Solo admin.';
  end if;

  -- Asegurar que slug existe (viene de migraciones antiguas, pero por seguridad)
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='resources' and column_name='slug'
  ) then
    alter table public.resources add column slug text;
    comment on column public.resources.slug is
      'Parte URL-friendly de la dirección del recurso (/recurso/{slug}). Único dentro del CMS.';
  end if;
end $$;


-- 2) Índice único sobre slug (si no existe ya) ------------------------------

create unique index if not exists idx_resources_slug_unique
  on public.resources (slug)
  where slug is not null and slug != '';

-- Índice para el JSONB de SEO (búsquedas por lang)
create index if not exists idx_resources_seo_by_lang
  on public.resources using gin (seo_by_lang);

-- Índice GIN sobre keywords para buscador interno
create index if not exists idx_resources_keywords
  on public.resources using gin (keywords);


-- 3) RPC: comprobar si un slug está disponible ------------------------------

create or replace function public.slug_is_available(
  p_slug text,
  p_exclude_resource_id uuid default null
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.resources
    where slug = p_slug
      and (p_exclude_resource_id is null or id != p_exclude_resource_id)
  );
$$;

comment on function public.slug_is_available(text, uuid) is
  'Devuelve TRUE si el slug está libre (o lo usa el propio recurso que estamos editando). El cliente llama a esta RPC con debounce.';

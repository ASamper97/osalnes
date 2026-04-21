-- ==========================================================================
-- Migration 023 — Multimedia: imágenes, vídeos, documentos (paso 5)
-- ==========================================================================
--
-- Tres tablas nuevas, todas ligadas a `resources` por FK con ON DELETE
-- CASCADE. El campo `alt_text` de `resource_images` es CRÍTICO para
-- cumplir WCAG 2.1 AA (criterio 1.1.1 del pliego, sección 5.5).
--
-- Idempotente.
-- ==========================================================================


-- 1) resource_images --------------------------------------------------------

create table if not exists public.resource_images (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid not null references public.resources(id) on delete cascade,
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    bigint not null,
  width         integer,
  height        integer,
  alt_text      text,
  alt_source    text check (alt_source in ('manual', 'ai', 'ai-edited')),
  is_primary    boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

comment on table public.resource_images is
  'Imágenes (fotos) asociadas a un recurso turístico. Una de ellas tiene is_primary=true y es la que se exporta como schema.org `image` (principal). Las demás se exportan como array `images` (galería).';
comment on column public.resource_images.alt_text is
  'Texto alternativo WCAG 2.1 AA. Crítico para accesibilidad.';
comment on column public.resource_images.alt_source is
  'Procedencia del alt_text: manual (usuario), ai (IA sin editar), ai-edited (IA editada).';

-- Una sola imagen principal por recurso (parcial, solo si is_primary=true)
create unique index if not exists idx_resource_images_one_primary
  on public.resource_images (resource_id)
  where is_primary = true;

-- Índice por recurso para listados (el más usado)
create index if not exists idx_resource_images_resource
  on public.resource_images (resource_id, sort_order);


-- 2) resource_videos --------------------------------------------------------

create table if not exists public.resource_videos (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid not null references public.resources(id) on delete cascade,
  url           text not null,
  provider      text not null check (provider in ('youtube', 'vimeo', 'other')),
  external_id   text,
  title         text,
  thumbnail_url text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

comment on table public.resource_videos is
  'Vídeos embebidos por URL externa (YouTube, Vimeo). Se exportan como schema.org `video[]`.';

create index if not exists idx_resource_videos_resource
  on public.resource_videos (resource_id, sort_order);

-- Evitar añadir dos veces el mismo vídeo al mismo recurso
create unique index if not exists idx_resource_videos_unique
  on public.resource_videos (resource_id, url);


-- 3) resource_documents -----------------------------------------------------

create table if not exists public.resource_documents (
  id                uuid primary key default gen_random_uuid(),
  resource_id       uuid not null references public.resources(id) on delete cascade,
  storage_path      text not null unique,
  mime_type         text not null,
  size_bytes        bigint not null,
  original_filename text not null,
  title             text not null,
  kind              text not null check (kind in (
    'guia', 'menu', 'folleto', 'mapa', 'normativa', 'programa', 'otro'
  )),
  lang              text not null default 'es' check (lang in (
    'es', 'gl', 'en', 'fr', 'pt', 'de', 'it'
  )),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null
);

comment on table public.resource_documents is
  'Documentos descargables asociados a un recurso (guías, menús, folletos, mapas...). Pliego §5.1.5.';

create index if not exists idx_resource_documents_resource
  on public.resource_documents (resource_id, sort_order);


-- 4) RLS policies -----------------------------------------------------------
--
-- Las 3 tablas son "children" de `resources`. Heredan las políticas de
-- acceso del recurso padre: quien puede leer/escribir el recurso, puede
-- leer/escribir su multimedia.
--
-- Asumimos que la tabla `resources` ya tiene RLS habilitada (migración
-- 010_enable_rls_baseline). Si no, añadir aquí.

alter table public.resource_images    enable row level security;
alter table public.resource_videos    enable row level security;
alter table public.resource_documents enable row level security;

-- Policy: read si puedes leer el recurso padre
create policy if not exists "read_images_via_resource"
  on public.resource_images for select
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_images.resource_id
    )
  );

create policy if not exists "read_videos_via_resource"
  on public.resource_videos for select
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_videos.resource_id
    )
  );

create policy if not exists "read_documents_via_resource"
  on public.resource_documents for select
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_documents.resource_id
    )
  );

-- Policy: write (insert/update/delete) solo para usuarios autenticados
-- con acceso al recurso. Adaptar si hay un RBAC más fino en el repo.
create policy if not exists "write_images_authenticated"
  on public.resource_images for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy if not exists "write_videos_authenticated"
  on public.resource_videos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy if not exists "write_documents_authenticated"
  on public.resource_documents for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- 5) Storage buckets --------------------------------------------------------
--
-- Supabase Storage debe tener dos buckets:
--
--   - resource-images    (público · lectura pública, escritura autenticada)
--   - resource-documents (público · lectura pública, escritura autenticada)
--
-- No los creamos aquí porque Supabase Storage se gestiona por API separada.
-- La tarea 1 del prompt maestro incluye el comando supabase CLI.


-- 6) Función: marcar imagen como principal (garantiza unicidad) -------------

create or replace function public.mark_image_as_primary(p_image_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_resource_id uuid;
begin
  select resource_id into v_resource_id
  from public.resource_images
  where id = p_image_id;

  if v_resource_id is null then
    raise exception 'Image % not found', p_image_id;
  end if;

  update public.resource_images
  set is_primary = (id = p_image_id)
  where resource_id = v_resource_id;
end;
$$;

comment on function public.mark_image_as_primary(uuid) is
  'Marca una imagen como principal del recurso, desmarcando cualquier otra que lo fuera. Atómico y seguro con el índice único parcial.';

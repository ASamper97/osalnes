-- ==========================================================================
-- Migration 027 — Listado fase B: duplicar + vistas guardadas + bulk actions
-- ==========================================================================
--
-- Añade:
--   1. RPC duplicate_resource(uuid) — copia profunda con nuevo UUID
--   2. Tabla saved_views + RPCs para vistas guardadas por usuario
--   3. RPCs bulk: bulk_change_status, bulk_delete, bulk_archive
--
-- Idempotente.
-- ==========================================================================


-- ─── 1) RPC duplicate_resource ─────────────────────────────────────────
--
-- Copia:
--   - Fila principal de resources (con nuevo UUID, estado draft,
--     slug único con sufijo, nombre con "(copia)").
--   - resource_images, resource_videos, resource_documents.
--   - resource_tags.
--   - No copia: audit_log, published_at, scheduled_publish_at,
--     og_image_override_path (el path del archivo quedaría duplicado
--     lógicamente, pero el blob en storage se mantiene compartido;
--     iteración futura: duplicar también el binario en Storage).
--
-- Devuelve el nuevo UUID para que el cliente pueda navegar al recurso
-- duplicado inmediatamente.

create or replace function public.duplicate_resource(
  p_source_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid := gen_random_uuid();
  v_slug_base text;
  v_slug_candidate text;
  v_counter integer := 1;
  v_src public.resources%rowtype;
begin
  -- Cargar el recurso origen
  select * into v_src from public.resources where id = p_source_id;
  if not found then
    raise exception 'Recurso origen % no existe', p_source_id;
  end if;

  -- Calcular slug único añadiendo -copia, -copia-2, -copia-3...
  v_slug_base := v_src.slug || '-copia';
  v_slug_candidate := v_slug_base;
  while exists (select 1 from public.resources where slug = v_slug_candidate) loop
    v_counter := v_counter + 1;
    v_slug_candidate := v_slug_base || '-' || v_counter;
  end loop;

  -- Insertar copia con nuevo UUID y campos reseteados
  insert into public.resources (
    id,
    single_type_vocabulary,
    name_es,
    name_gl,
    slug,
    description_es,
    description_gl,
    access_public,
    access_free,
    visible_on_map,
    latitude,
    longitude,
    street_address,
    postal_code,
    contact_phone,
    contact_email,
    contact_web,
    hours_plan,
    municipality_id,
    accommodation_rating,
    occupancy,
    serves_cuisine,
    seo_by_lang,
    translations,
    keywords,
    indexable,
    canonical_url,
    -- Los siguientes campos se resetean explícitamente:
    publication_status,
    published_at,
    published_by,
    scheduled_publish_at,
    og_image_override_path,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_new_id,
    v_src.single_type_vocabulary,
    coalesce(v_src.name_es, '') || ' (copia)',
    case when v_src.name_gl is not null and v_src.name_gl <> ''
         then v_src.name_gl || ' (copia)'
         else v_src.name_gl
    end,
    v_slug_candidate,
    v_src.description_es,
    v_src.description_gl,
    v_src.access_public,
    v_src.access_free,
    v_src.visible_on_map,
    v_src.latitude,
    v_src.longitude,
    v_src.street_address,
    v_src.postal_code,
    v_src.contact_phone,
    v_src.contact_email,
    v_src.contact_web,
    v_src.hours_plan,
    v_src.municipality_id,
    v_src.accommodation_rating,
    v_src.occupancy,
    v_src.serves_cuisine,
    v_src.seo_by_lang,
    v_src.translations,
    v_src.keywords,
    v_src.indexable,
    v_src.canonical_url,
    'draft',                    -- siempre draft
    null,                       -- sin published_at
    null,                       -- sin published_by
    null,                       -- sin scheduled_publish_at
    null,                       -- sin override OG (usa la principal del paso 5)
    auth.uid(),                 -- el que duplica es el nuevo creador
    now(),
    now()
  );

  -- Copiar imágenes
  insert into public.resource_images (
    id, resource_id, path, alt_text, is_primary, order_index, uploaded_at
  )
  select gen_random_uuid(), v_new_id, path, alt_text, is_primary, order_index, now()
  from public.resource_images where resource_id = p_source_id;

  -- Copiar vídeos
  insert into public.resource_videos (
    id, resource_id, url, title, provider, order_index, created_at
  )
  select gen_random_uuid(), v_new_id, url, title, provider, order_index, now()
  from public.resource_videos where resource_id = p_source_id;

  -- Copiar documentos
  insert into public.resource_documents (
    id, resource_id, path, title, doc_type, language, size_bytes, order_index, uploaded_at
  )
  select gen_random_uuid(), v_new_id, path, title, doc_type, language, size_bytes, order_index, now()
  from public.resource_documents where resource_id = p_source_id;

  -- Copiar tags
  insert into public.resource_tags (resource_id, tag_key)
  select v_new_id, tag_key
  from public.resource_tags where resource_id = p_source_id;

  return v_new_id;
end;
$$;

comment on function public.duplicate_resource is
  'Copia profunda de un recurso: crea nueva fila en resources con nuevo UUID y slug único, copia sus imágenes/vídeos/documentos/tags. Resetea estado a draft. Devuelve el nuevo UUID.';


-- ─── 2) Tabla saved_views + RPCs ───────────────────────────────────────

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Serialización del ListFilters del cliente (JSONB por flexibilidad)
  filters jsonb not null default '{}'::jsonb,
  -- Opcional: el usuario puede fijar orden y tamaño de página también
  sort_order_by text,
  sort_order_dir text check (sort_order_dir is null or sort_order_dir in ('asc', 'desc')),
  page_size integer check (page_size is null or page_size between 1 and 200),
  -- Si true, aparece como vista por defecto al abrir el listado
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un usuario no puede tener dos vistas con el mismo nombre
  unique(owner_id, name)
);

comment on table public.saved_views is
  'Vistas guardadas del listado de recursos por usuario. Permite guardar combinaciones de filtros/orden favoritas.';

-- Solo una vista por defecto por usuario (índice parcial)
create unique index if not exists idx_saved_views_one_default_per_user
  on public.saved_views (owner_id)
  where is_default = true;

-- Index para listar vistas del usuario actual
create index if not exists idx_saved_views_owner
  on public.saved_views (owner_id, updated_at desc);

-- RLS: cada usuario solo ve sus propias vistas
alter table public.saved_views enable row level security;

drop policy if exists saved_views_owner_rw on public.saved_views;
create policy saved_views_owner_rw on public.saved_views
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- RPC: listar vistas del usuario actual
create or replace function public.list_saved_views()
returns setof public.saved_views
language sql
stable
security definer
as $$
  select * from public.saved_views
  where owner_id = auth.uid()
  order by is_default desc, updated_at desc;
$$;

-- RPC: guardar vista (upsert por nombre)
create or replace function public.upsert_saved_view(
  p_name text,
  p_filters jsonb,
  p_sort_order_by text default null,
  p_sort_order_dir text default null,
  p_page_size integer default null,
  p_is_default boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  -- Si se marca como default, desmarcar las otras del usuario
  if p_is_default then
    update public.saved_views
    set is_default = false
    where owner_id = auth.uid() and is_default = true;
  end if;

  -- Upsert
  insert into public.saved_views (
    owner_id, name, filters, sort_order_by, sort_order_dir, page_size, is_default, updated_at
  )
  values (
    auth.uid(), p_name, p_filters, p_sort_order_by, p_sort_order_dir, p_page_size, p_is_default, now()
  )
  on conflict (owner_id, name) do update
    set filters = excluded.filters,
        sort_order_by = excluded.sort_order_by,
        sort_order_dir = excluded.sort_order_dir,
        page_size = excluded.page_size,
        is_default = excluded.is_default,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- RPC: borrar vista
create or replace function public.delete_saved_view(p_view_id uuid)
returns void
language sql
security definer
as $$
  delete from public.saved_views
  where id = p_view_id and owner_id = auth.uid();
$$;


-- ─── 3) RPCs de acciones masivas ────────────────────────────────────────

create or replace function public.bulk_change_status(
  p_resource_ids uuid[],
  p_new_status text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  if p_new_status not in ('draft', 'published', 'scheduled', 'archived', 'in_review') then
    raise exception 'Estado inválido: %', p_new_status;
  end if;

  update public.resources
  set publication_status = p_new_status,
      published_at = case when p_new_status = 'published' then now() else published_at end,
      published_by = case when p_new_status = 'published' then auth.uid() else published_by end,
      scheduled_publish_at = case when p_new_status <> 'scheduled' then null else scheduled_publish_at end,
      updated_at = now()
  where id = any(p_resource_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.bulk_change_status is
  'Cambia el estado de múltiples recursos de golpe. Devuelve el número de recursos afectados.';

create or replace function public.bulk_delete_resources(
  p_resource_ids uuid[]
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  delete from public.resources
  where id = any(p_resource_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.bulk_delete_resources is
  'Elimina múltiples recursos. Usar con confirmación explícita en el cliente.';

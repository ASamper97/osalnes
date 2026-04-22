-- ==========================================================================
-- Migration 027 — Listado fase B: duplicar + vistas guardadas + bulk actions
-- ==========================================================================
--
-- Adaptado al schema real (igual que 026):
--   - Tabla `recurso_turistico` (NO `resources`).
--   - `estado_editorial` Spanish (NO `publication_status` English).
--   - Nombre/descripción en `traduccion` (NO columnas name_es/name_gl/...).
--   - Columnas paso 3/4/5/6: `visible_en_mapa`, `public_access`,
--     `is_accessible_for_free`, `opening_hours_plan`, `municipio_id`,
--     `og_image_override_path`, etc.
--   - `resource_images.storage_path/sort_order` (NO `path/order_index`).
--   - `resource_videos.sort_order` + campos del paso 5 (external_id,
--     thumbnail_url).
--   - `resource_documents.storage_path/kind/lang/sort_order` +
--     `mime_type/original_filename/size_bytes`.
--
-- Añade:
--   1. RPC duplicate_resource(uuid) — copia profunda con nuevo UUID.
--      * Clona la fila de recurso_turistico con estado 'borrador'.
--      * Clona las filas de traduccion (name + description en todos los
--        idiomas) con sufijo '(copia)' en name_es.
--      * Clona resource_images, resource_videos, resource_documents y
--        resource_tags con nuevos UUIDs.
--      * NO duplica el binario físico en Storage (el aviso 3 del prompt
--        documenta esta deuda): los paths apuntan al mismo blob.
--   2. Tabla saved_views + RPCs (list/upsert/delete) con RLS.
--   3. RPCs bulk: bulk_change_status, bulk_delete_resources.
--
-- Idempotente.
-- ==========================================================================


-- ─── 1) RPC duplicate_resource ─────────────────────────────────────────

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
  v_src public.recurso_turistico%rowtype;
  v_new_uri text;
begin
  -- Cargar el recurso origen
  select * into v_src from public.recurso_turistico where id = p_source_id;
  if not found then
    raise exception 'Recurso origen % no existe', p_source_id;
  end if;

  -- Calcular slug único añadiendo -copia, -copia-2, ...
  v_slug_base := v_src.slug || '-copia';
  v_slug_candidate := v_slug_base;
  while exists (select 1 from public.recurso_turistico where slug = v_slug_candidate) loop
    v_counter := v_counter + 1;
    v_slug_candidate := v_slug_base || '-' || v_counter;
  end loop;

  -- URI estable coherente con admin.createResource: osalnes:recurso:{slug}
  v_new_uri := 'osalnes:recurso:' || v_slug_candidate;

  -- Insertar copia con nuevo UUID y campos reseteados
  insert into public.recurso_turistico (
    id,
    uri,
    rdf_type,
    rdf_types,
    slug,
    municipio_id,
    zona_id,
    -- Paso 3 · t4 (estructurado + legacy espejo)
    latitude, longitude,
    address_street, address_postal,
    telephone, email, url, same_as,
    opening_hours,
    street_address, postal_code, locality, parroquia_text,
    contact_phone, contact_email, contact_web,
    social_links, opening_hours_plan,
    -- Paso 4 · t5 (establishment)
    accommodation_rating, occupancy, serves_cuisine,
    -- Flags legacy
    tourist_types, rating_value,
    is_accessible_for_free, public_access,
    visible_en_mapa,
    extras,
    -- Paso 6 · t4 (SEO)
    seo_by_lang, translations, keywords, indexable, canonical_url,
    -- RESETEADOS explícitamente:
    estado_editorial,            -- 'borrador'
    published_at,                -- null
    published_by,                -- null
    scheduled_publish_at,        -- null
    og_image_override_path,      -- null (iteración futura: copiar blob)
    created_by,                  -- auth.uid() (quien duplica)
    updated_by,
    created_at, updated_at
  )
  values (
    v_new_id,
    v_new_uri,
    v_src.rdf_type,
    v_src.rdf_types,
    v_slug_candidate,
    v_src.municipio_id,
    v_src.zona_id,
    v_src.latitude, v_src.longitude,
    v_src.address_street, v_src.address_postal,
    v_src.telephone, v_src.email, v_src.url, v_src.same_as,
    v_src.opening_hours,
    v_src.street_address, v_src.postal_code, v_src.locality, v_src.parroquia_text,
    v_src.contact_phone, v_src.contact_email, v_src.contact_web,
    v_src.social_links, v_src.opening_hours_plan,
    v_src.accommodation_rating, v_src.occupancy, v_src.serves_cuisine,
    v_src.tourist_types, v_src.rating_value,
    v_src.is_accessible_for_free, v_src.public_access,
    v_src.visible_en_mapa,
    v_src.extras,
    v_src.seo_by_lang, v_src.translations, v_src.keywords, v_src.indexable, v_src.canonical_url,
    'borrador',
    null, null, null, null,
    auth.uid(), auth.uid(),
    now(), now()
  );

  -- Copiar traducciones (name + description en todos los idiomas).
  -- Añadimos sufijo '(copia)' al name_es y name_gl para distinguir el
  -- duplicado en el listado. El resto de idiomas se copia literal.
  insert into public.traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
  select
    'recurso_turistico',
    v_new_id,
    t.campo,
    t.idioma,
    case
      when t.campo = 'name' and t.idioma in ('es', 'gl')
        then t.valor || ' (copia)'
      else t.valor
    end
  from public.traduccion t
  where t.entidad_tipo = 'recurso_turistico'
    and t.entidad_id = p_source_id;

  -- Copiar imágenes (columnas reales del paso 5 · t1)
  insert into public.resource_images (
    id, resource_id, storage_path, mime_type, size_bytes,
    width, height, alt_text, alt_source, is_primary, sort_order,
    created_at, created_by
  )
  select
    gen_random_uuid(), v_new_id, storage_path, mime_type, size_bytes,
    width, height, alt_text, alt_source, is_primary, sort_order,
    now(), auth.uid()
  from public.resource_images
  where resource_id = p_source_id;

  -- Copiar vídeos (URL externa del paso 5)
  insert into public.resource_videos (
    id, resource_id, url, provider, external_id, title, thumbnail_url,
    sort_order, created_at, created_by
  )
  select
    gen_random_uuid(), v_new_id, url, provider, external_id, title, thumbnail_url,
    sort_order, now(), auth.uid()
  from public.resource_videos
  where resource_id = p_source_id;

  -- Copiar documentos
  insert into public.resource_documents (
    id, resource_id, storage_path, mime_type, size_bytes, original_filename,
    title, kind, lang, sort_order, created_at, created_by
  )
  select
    gen_random_uuid(), v_new_id, storage_path, mime_type, size_bytes, original_filename,
    title, kind, lang, sort_order, now(), auth.uid()
  from public.resource_documents
  where resource_id = p_source_id;

  -- Copiar tags UNE 178503 (paso 4 · t1)
  insert into public.resource_tags (resource_id, tag_key, field, value, pid_exportable, source)
  select v_new_id, tag_key, field, value, pid_exportable, source
  from public.resource_tags
  where resource_id = p_source_id;

  return v_new_id;
end;
$$;

comment on function public.duplicate_resource is
  'Copia profunda de un recurso: crea nueva fila en recurso_turistico con nuevo UUID y slug único, copia traducciones (sufijo "(copia)" en name ES/GL), imágenes/vídeos/documentos/tags. Resetea estado a borrador. Los blobs físicos de Storage NO se duplican (ambos recursos apuntan al mismo archivo — deuda para iteración futura). Devuelve el nuevo UUID.';


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
  -- Valores Spanish del CHECK real de recurso_turistico.estado_editorial
  if p_new_status not in ('borrador', 'revision', 'programado', 'publicado', 'archivado') then
    raise exception 'Estado inválido: %', p_new_status;
  end if;

  update public.recurso_turistico
  set estado_editorial = p_new_status,
      published_at = case when p_new_status = 'publicado' then now() else published_at end,
      published_by = case when p_new_status = 'publicado' then auth.uid() else published_by end,
      scheduled_publish_at = case when p_new_status <> 'programado' then null else scheduled_publish_at end,
      updated_at = now()
  where id = any(p_resource_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.bulk_change_status is
  'Cambia estado_editorial de múltiples recursos de golpe. Acepta valores Spanish del CHECK. Devuelve el número de recursos afectados.';

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
  delete from public.recurso_turistico
  where id = any(p_resource_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.bulk_delete_resources is
  'Elimina múltiples recursos. Usar con confirmación explícita en el cliente.';

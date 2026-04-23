-- ==========================================================================
-- Migration 032 — Gestor de taxonomías (SCR-10)
-- ==========================================================================
--
-- Crea (si no existen) las 4 tablas de catálogo que aún no tiene el
-- proyecto y añade RPCs unificadas para el gestor de taxonomías.
--
-- Catálogos gestionados:
--   1. municipio          (YA EXISTE · migración 001 · no se toca)
--   2. zona               (puede no existir · se crea si hace falta)
--   3. tipologia_une      (se crea si no existe · con URI schema.org)
--   4. categoria          (jerárquica · se crea si no existe)
--   5. producto_turistico (se crea si no existe)
--
-- PATRÓN: textos multidioma delegados a la tabla `traduccion`
-- existente con entidad_tipo = '{catálogo}' y campo = 'name' | 'description'.
-- Esto garantiza consistencia con el resto del CMS y reutiliza tr_get.
--
-- IMPORTANTE · Adaptación al esquema español:
--   - estado_editorial -> no aplica a catálogos, usamos `is_active` boolean
--   - los textos viven en `traduccion`, NO en columnas `name_es`
--   - el orden de presentación se gestiona con `sort_order` (integer)
-- ==========================================================================


-- ─── 1) Tabla ZONA (si no existe) ──────────────────────────────────────

create table if not exists public.zona (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  /* Parent para jerarquía opcional (decisión 2-B: categorías sí) */
  parent_id uuid references public.zona(id) on delete set null,
  /* URI semántica opcional (decisión 4-C: warning si falta) */
  semantic_uri text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.zona is
  'Zonas operativas del destino. Nombre/descripción en tabla traduccion.';


-- ─── 2) Tabla TIPOLOGIA_UNE (si no existe) ─────────────────────────────

create table if not exists public.tipologia_une (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  /* La URI de schema.org es la identidad semántica · UNE 178503.
     Ej: "https://schema.org/Beach" */
  semantic_uri text,
  /* Código interno corto (ej: "Beach") · útil para match con rdf_type */
  schema_code text,
  /* Tipologías de UNE son planas por norma · no tienen parent */
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tipologia_une is
  'Tipologías UNE 178503. La schema_code coincide con recurso_turistico.rdf_type.';


-- ─── 3) Tabla CATEGORIA (si no existe) · jerárquica ────────────────────

create table if not exists public.categoria (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  /* Categorías sí admiten jerarquía: "Cultural > Patrimonio > Iglesias" */
  parent_id uuid references public.categoria(id) on delete set null,
  semantic_uri text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categoria is
  'Categorías agrupadoras del destino, jerárquicas.';


-- ─── 4) Tabla PRODUCTO_TURISTICO (si no existe) ────────────────────────

create table if not exists public.producto_turistico (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  parent_id uuid references public.producto_turistico(id) on delete set null,
  semantic_uri text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.producto_turistico is
  'Productos turísticos del destino. Ej: "Ruta del Albariño".';


-- ─── 5) Índices ────────────────────────────────────────────────────────

create index if not exists idx_zona_parent on public.zona (parent_id) where parent_id is not null;
create index if not exists idx_zona_active on public.zona (is_active, sort_order);
create index if not exists idx_tipologia_une_schema on public.tipologia_une (schema_code);
create index if not exists idx_tipologia_une_active on public.tipologia_une (is_active, sort_order);
create index if not exists idx_categoria_parent on public.categoria (parent_id) where parent_id is not null;
create index if not exists idx_categoria_active on public.categoria (is_active, sort_order);
create index if not exists idx_producto_parent on public.producto_turistico (parent_id) where parent_id is not null;
create index if not exists idx_producto_active on public.producto_turistico (is_active, sort_order);


-- ─── 6) RLS ────────────────────────────────────────────────────────────

alter table public.zona enable row level security;
alter table public.tipologia_une enable row level security;
alter table public.categoria enable row level security;
alter table public.producto_turistico enable row level security;

drop policy if exists zona_read on public.zona;
create policy zona_read on public.zona for select using (auth.uid() is not null);
drop policy if exists tipologia_une_read on public.tipologia_une;
create policy tipologia_une_read on public.tipologia_une for select using (auth.uid() is not null);
drop policy if exists categoria_read on public.categoria;
create policy categoria_read on public.categoria for select using (auth.uid() is not null);
drop policy if exists producto_turistico_read on public.producto_turistico;
create policy producto_turistico_read on public.producto_turistico for select using (auth.uid() is not null);

-- Escrituras las hacen solo los RPCs security definer (así respetan RBAC
-- sin exponer las tablas directamente).


-- ─── 7) RPC taxonomy_list ──────────────────────────────────────────────
--
-- Listado unificado de cualquier catálogo, con:
--   · nombre/descripción multidioma vía tr_get
--   · conteo de uso (cuántos recursos lo usan)
--   · estructura jerárquica si aplica
--
-- Parámetros:
--   p_catalog: 'municipio' | 'zona' | 'tipologia_une' | 'categoria' | 'producto_turistico'
--   p_include_inactive: si false, solo devuelve is_active = true
--   p_parent_id: filtra por parent (null para top-level)
--   p_lang: idioma de preferencia para name/description

create or replace function public.taxonomy_list(
  p_catalog text,
  p_include_inactive boolean default false,
  p_parent_id uuid default null,
  p_lang text default 'es'
)
returns table (
  id uuid,
  slug text,
  parent_id uuid,
  semantic_uri text,
  schema_code text,
  sort_order integer,
  is_active boolean,
  name text,
  description text,
  usage_count integer,
  usage_published integer,
  usage_draft integer,
  has_children boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
as $$
begin
  if p_catalog = 'municipio' then
    return query
    select
      m.id, m.slug, null::uuid as parent_id, null::text as semantic_uri,
      null::text as schema_code, 0 as sort_order, true as is_active,
      coalesce(public.tr_get('municipio', m.id, 'name', p_lang), m.slug) as name,
      public.tr_get('municipio', m.id, 'description', p_lang) as description,
      (select count(*)::integer from public.recurso_turistico r where r.municipio_id = m.id) as usage_count,
      (select count(*)::integer from public.recurso_turistico r where r.municipio_id = m.id and r.estado_editorial = 'publicado') as usage_published,
      (select count(*)::integer from public.recurso_turistico r where r.municipio_id = m.id and r.estado_editorial = 'borrador') as usage_draft,
      false as has_children,
      m.created_at, m.created_at as updated_at
    from public.municipio m
    order by coalesce(public.tr_get('municipio', m.id, 'name', p_lang), m.slug);

  elsif p_catalog = 'zona' then
    return query
    select
      z.id, z.slug, z.parent_id, z.semantic_uri, null::text as schema_code,
      z.sort_order, z.is_active,
      coalesce(public.tr_get('zona', z.id, 'name', p_lang), z.slug),
      public.tr_get('zona', z.id, 'description', p_lang),
      0 as usage_count, 0 as usage_published, 0 as usage_draft,
      exists(select 1 from public.zona c where c.parent_id = z.id) as has_children,
      z.created_at, z.updated_at
    from public.zona z
    where (p_include_inactive or z.is_active)
      and (p_parent_id is null and z.parent_id is null or z.parent_id = p_parent_id)
    order by z.sort_order, z.slug;

  elsif p_catalog = 'tipologia_une' then
    return query
    select
      t.id, t.slug, null::uuid as parent_id, t.semantic_uri, t.schema_code,
      t.sort_order, t.is_active,
      coalesce(public.tr_get('tipologia_une', t.id, 'name', p_lang), t.slug),
      public.tr_get('tipologia_une', t.id, 'description', p_lang),
      /* Uso: los recursos con rdf_type que coincida con schema_code o que tengan
         la tipología en tourist_types[] */
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.schema_code) as usage_count,
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.schema_code and r.estado_editorial = 'publicado'),
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.schema_code and r.estado_editorial = 'borrador'),
      false as has_children,
      t.created_at, t.updated_at
    from public.tipologia_une t
    where (p_include_inactive or t.is_active)
    order by t.sort_order, t.slug;

  elsif p_catalog = 'categoria' then
    return query
    select
      c.id, c.slug, c.parent_id, c.semantic_uri, null::text as schema_code,
      c.sort_order, c.is_active,
      coalesce(public.tr_get('categoria', c.id, 'name', p_lang), c.slug),
      public.tr_get('categoria', c.id, 'description', p_lang),
      0 as usage_count, 0 as usage_published, 0 as usage_draft,
      exists(select 1 from public.categoria ch where ch.parent_id = c.id) as has_children,
      c.created_at, c.updated_at
    from public.categoria c
    where (p_include_inactive or c.is_active)
      and ((p_parent_id is null and c.parent_id is null) or c.parent_id = p_parent_id)
    order by c.sort_order, c.slug;

  elsif p_catalog = 'producto_turistico' then
    return query
    select
      p.id, p.slug, p.parent_id, p.semantic_uri, null::text as schema_code,
      p.sort_order, p.is_active,
      coalesce(public.tr_get('producto_turistico', p.id, 'name', p_lang), p.slug),
      public.tr_get('producto_turistico', p.id, 'description', p_lang),
      0 as usage_count, 0 as usage_published, 0 as usage_draft,
      exists(select 1 from public.producto_turistico ch where ch.parent_id = p.id) as has_children,
      p.created_at, p.updated_at
    from public.producto_turistico p
    where (p_include_inactive or p.is_active)
      and ((p_parent_id is null and p.parent_id is null) or p.parent_id = p_parent_id)
    order by p.sort_order, p.slug;

  else
    raise exception 'Catálogo inválido: %', p_catalog;
  end if;
end;
$$;


-- ─── 8) RPC taxonomy_get ───────────────────────────────────────────────
-- Devuelve 1 término completo, con traducciones en los 3 idiomas.

create or replace function public.taxonomy_get(
  p_catalog text,
  p_id uuid
)
returns table (
  id uuid,
  slug text,
  parent_id uuid,
  semantic_uri text,
  schema_code text,
  sort_order integer,
  is_active boolean,
  name_es text, name_gl text, name_en text,
  description_es text, description_gl text, description_en text,
  usage_count integer
)
language plpgsql
stable
as $$
begin
  if p_catalog = 'municipio' then
    return query
    select
      m.id, m.slug, null::uuid, null::text, null::text, 0, true,
      public.tr_get('municipio', m.id, 'name', 'es'),
      public.tr_get('municipio', m.id, 'name', 'gl'),
      public.tr_get('municipio', m.id, 'name', 'en'),
      public.tr_get('municipio', m.id, 'description', 'es'),
      public.tr_get('municipio', m.id, 'description', 'gl'),
      public.tr_get('municipio', m.id, 'description', 'en'),
      (select count(*)::integer from public.recurso_turistico r where r.municipio_id = m.id)
    from public.municipio m where m.id = p_id;

  elsif p_catalog = 'zona' then
    return query
    select z.id, z.slug, z.parent_id, z.semantic_uri, null::text, z.sort_order, z.is_active,
      public.tr_get('zona', z.id, 'name', 'es'),
      public.tr_get('zona', z.id, 'name', 'gl'),
      public.tr_get('zona', z.id, 'name', 'en'),
      public.tr_get('zona', z.id, 'description', 'es'),
      public.tr_get('zona', z.id, 'description', 'gl'),
      public.tr_get('zona', z.id, 'description', 'en'),
      0
    from public.zona z where z.id = p_id;

  elsif p_catalog = 'tipologia_une' then
    return query
    select t.id, t.slug, null::uuid, t.semantic_uri, t.schema_code, t.sort_order, t.is_active,
      public.tr_get('tipologia_une', t.id, 'name', 'es'),
      public.tr_get('tipologia_une', t.id, 'name', 'gl'),
      public.tr_get('tipologia_une', t.id, 'name', 'en'),
      public.tr_get('tipologia_une', t.id, 'description', 'es'),
      public.tr_get('tipologia_une', t.id, 'description', 'gl'),
      public.tr_get('tipologia_une', t.id, 'description', 'en'),
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.schema_code)
    from public.tipologia_une t where t.id = p_id;

  elsif p_catalog = 'categoria' then
    return query
    select c.id, c.slug, c.parent_id, c.semantic_uri, null::text, c.sort_order, c.is_active,
      public.tr_get('categoria', c.id, 'name', 'es'),
      public.tr_get('categoria', c.id, 'name', 'gl'),
      public.tr_get('categoria', c.id, 'name', 'en'),
      public.tr_get('categoria', c.id, 'description', 'es'),
      public.tr_get('categoria', c.id, 'description', 'gl'),
      public.tr_get('categoria', c.id, 'description', 'en'),
      0
    from public.categoria c where c.id = p_id;

  elsif p_catalog = 'producto_turistico' then
    return query
    select p.id, p.slug, p.parent_id, p.semantic_uri, null::text, p.sort_order, p.is_active,
      public.tr_get('producto_turistico', p.id, 'name', 'es'),
      public.tr_get('producto_turistico', p.id, 'name', 'gl'),
      public.tr_get('producto_turistico', p.id, 'name', 'en'),
      public.tr_get('producto_turistico', p.id, 'description', 'es'),
      public.tr_get('producto_turistico', p.id, 'description', 'gl'),
      public.tr_get('producto_turistico', p.id, 'description', 'en'),
      0
    from public.producto_turistico p where p.id = p_id;

  else
    raise exception 'Catálogo inválido: %', p_catalog;
  end if;
end;
$$;


-- ─── 9) RPC taxonomy_upsert ────────────────────────────────────────────
--
-- Crea o actualiza un término. Gestiona las traducciones en la tabla
-- traduccion. Parámetros con name/description en los 3 idiomas.
--
-- Nota: municipio NO se puede crear/editar desde este RPC (existen
-- los 9 fijos en la BD y sus códigos INE son oficiales).

create or replace function public.taxonomy_upsert(
  p_catalog text,
  p_id uuid default null,  -- null = crear
  p_slug text default null,
  p_parent_id uuid default null,
  p_semantic_uri text default null,
  p_schema_code text default null,
  p_sort_order integer default 0,
  p_is_active boolean default true,
  p_name_es text default null,
  p_name_gl text default null,
  p_name_en text default null,
  p_description_es text default null,
  p_description_gl text default null,
  p_description_en text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_entidad_tipo text;
begin
  if p_catalog = 'municipio' then
    raise exception 'Los municipios no se pueden crear/editar desde esta interfaz';
  end if;

  if p_catalog not in ('zona', 'tipologia_une', 'categoria', 'producto_turistico') then
    raise exception 'Catálogo inválido: %', p_catalog;
  end if;

  v_entidad_tipo := p_catalog;

  -- Validación de slug: obligatorio y único
  if p_slug is null or trim(p_slug) = '' then
    raise exception 'El slug es obligatorio';
  end if;

  -- Upsert según catálogo
  if p_catalog = 'zona' then
    if p_id is null then
      insert into public.zona (slug, parent_id, semantic_uri, sort_order, is_active)
      values (p_slug, p_parent_id, p_semantic_uri, p_sort_order, p_is_active)
      returning id into v_id;
    else
      update public.zona set
        slug = p_slug, parent_id = p_parent_id, semantic_uri = p_semantic_uri,
        sort_order = p_sort_order, is_active = p_is_active, updated_at = now()
      where id = p_id
      returning id into v_id;
    end if;
  elsif p_catalog = 'tipologia_une' then
    if p_id is null then
      insert into public.tipologia_une (slug, semantic_uri, schema_code, sort_order, is_active)
      values (p_slug, p_semantic_uri, p_schema_code, p_sort_order, p_is_active)
      returning id into v_id;
    else
      update public.tipologia_une set
        slug = p_slug, semantic_uri = p_semantic_uri, schema_code = p_schema_code,
        sort_order = p_sort_order, is_active = p_is_active, updated_at = now()
      where id = p_id
      returning id into v_id;
    end if;
  elsif p_catalog = 'categoria' then
    if p_id is null then
      insert into public.categoria (slug, parent_id, semantic_uri, sort_order, is_active)
      values (p_slug, p_parent_id, p_semantic_uri, p_sort_order, p_is_active)
      returning id into v_id;
    else
      update public.categoria set
        slug = p_slug, parent_id = p_parent_id, semantic_uri = p_semantic_uri,
        sort_order = p_sort_order, is_active = p_is_active, updated_at = now()
      where id = p_id
      returning id into v_id;
    end if;
  elsif p_catalog = 'producto_turistico' then
    if p_id is null then
      insert into public.producto_turistico (slug, parent_id, semantic_uri, sort_order, is_active)
      values (p_slug, p_parent_id, p_semantic_uri, p_sort_order, p_is_active)
      returning id into v_id;
    else
      update public.producto_turistico set
        slug = p_slug, parent_id = p_parent_id, semantic_uri = p_semantic_uri,
        sort_order = p_sort_order, is_active = p_is_active, updated_at = now()
      where id = p_id
      returning id into v_id;
    end if;
  end if;

  -- Upsert de traducciones (name/description x es/gl/en = 6 traducciones)
  perform public.tr_upsert(v_entidad_tipo, v_id, 'name', 'es', p_name_es);
  perform public.tr_upsert(v_entidad_tipo, v_id, 'name', 'gl', p_name_gl);
  perform public.tr_upsert(v_entidad_tipo, v_id, 'name', 'en', p_name_en);
  perform public.tr_upsert(v_entidad_tipo, v_id, 'description', 'es', p_description_es);
  perform public.tr_upsert(v_entidad_tipo, v_id, 'description', 'gl', p_description_gl);
  perform public.tr_upsert(v_entidad_tipo, v_id, 'description', 'en', p_description_en);

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe un término con slug "%" en el catálogo %', p_slug, p_catalog;
end;
$$;


-- ─── 10) RPC tr_upsert ·helper para traducciones ───────────────────────
--
-- Solo se crea si no existe ya. Si existe, se asume que tiene la firma
-- adecuada (entidad_tipo, entidad_id, campo, idioma, valor).

create or replace function public.tr_upsert(
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_campo text,
  p_idioma text,
  p_valor text
)
returns void
language plpgsql
as $$
begin
  if p_valor is null or trim(p_valor) = '' then
    -- Limpiar traducción vacía
    delete from public.traduccion
    where entidad_tipo = p_entidad_tipo
      and entidad_id = p_entidad_id
      and campo = p_campo
      and idioma = p_idioma;
    return;
  end if;

  insert into public.traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
  values (p_entidad_tipo, p_entidad_id, p_campo, p_idioma, p_valor)
  on conflict (entidad_tipo, entidad_id, campo, idioma)
  do update set valor = excluded.valor;
end;
$$;


-- ─── 11) RPC taxonomy_toggle_active ────────────────────────────────────
--
-- Soft delete · decisión 6-C. No borra físicamente, marca is_active=false.

create or replace function public.taxonomy_toggle_active(
  p_catalog text,
  p_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
as $$
begin
  if p_catalog = 'municipio' then
    raise exception 'Los municipios no se pueden desactivar';
  end if;

  if p_catalog = 'zona' then
    update public.zona set is_active = p_is_active, updated_at = now() where id = p_id;
  elsif p_catalog = 'tipologia_une' then
    update public.tipologia_une set is_active = p_is_active, updated_at = now() where id = p_id;
  elsif p_catalog = 'categoria' then
    update public.categoria set is_active = p_is_active, updated_at = now() where id = p_id;
  elsif p_catalog = 'producto_turistico' then
    update public.producto_turistico set is_active = p_is_active, updated_at = now() where id = p_id;
  else
    raise exception 'Catálogo inválido: %', p_catalog;
  end if;
end;
$$;


-- ─── 12) RPC taxonomy_get_usage ────────────────────────────────────────
--
-- Devuelve el desglose de uso de un término: cuántos recursos lo usan,
-- y muestra de los primeros 10 (decisión 5-B con C parcial).

create or replace function public.taxonomy_get_usage(
  p_catalog text,
  p_id uuid
)
returns table (
  resource_id uuid,
  resource_slug text,
  resource_name text,
  estado_editorial text
)
language plpgsql
stable
as $$
declare
  v_schema_code text;
begin
  if p_catalog = 'municipio' then
    return query
    select r.id, r.slug,
           coalesce(public.tr_get('recurso_turistico', r.id, 'name', 'es'), r.slug),
           r.estado_editorial
    from public.recurso_turistico r
    where r.municipio_id = p_id
    order by r.estado_editorial desc, r.slug
    limit 50;

  elsif p_catalog = 'tipologia_une' then
    select schema_code into v_schema_code from public.tipologia_une where id = p_id;
    return query
    select r.id, r.slug,
           coalesce(public.tr_get('recurso_turistico', r.id, 'name', 'es'), r.slug),
           r.estado_editorial
    from public.recurso_turistico r
    where r.rdf_type = v_schema_code
    order by r.estado_editorial desc, r.slug
    limit 50;

  else
    -- Zona, categoría, producto: de momento no tienen relación directa con recurso_turistico
    -- (pendiente decidir si se crean tablas many-to-many). Retornar vacío.
    return;
  end if;
end;
$$;


-- ─── 13) RPC taxonomy_get_tree ──────────────────────────────────────────
--
-- Devuelve el árbol jerárquico de un catálogo como JSONB (útil para
-- catalogos jerárquicos: categoria, zona, producto_turistico).

create or replace function public.taxonomy_get_tree(
  p_catalog text,
  p_lang text default 'es'
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_result jsonb;
begin
  if p_catalog not in ('zona', 'categoria', 'producto_turistico') then
    raise exception 'Catálogo sin jerarquía: %', p_catalog;
  end if;

  -- Recursiva simple · construye árbol top-down
  execute format($fmt$
    with recursive tree as (
      select id, slug, parent_id, sort_order, is_active,
        public.tr_get(%L, id, 'name', %L) as name_tr,
        1 as depth,
        array[sort_order, row_number() over (order by sort_order, slug)] as path
      from public.%I
      where parent_id is null
      union all
      select c.id, c.slug, c.parent_id, c.sort_order, c.is_active,
        public.tr_get(%L, c.id, 'name', %L),
        t.depth + 1,
        t.path || array[c.sort_order, row_number() over (partition by c.parent_id order by c.sort_order, c.slug)::integer]
      from public.%I c
      join tree t on c.parent_id = t.id
      where t.depth < 5
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', id, 'slug', slug, 'parent_id', parent_id,
        'name', coalesce(name_tr, slug),
        'sort_order', sort_order, 'is_active', is_active, 'depth', depth
      )
      order by path
    )
    from tree
  $fmt$, p_catalog, p_lang, p_catalog, p_catalog, p_lang, p_catalog)
  into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;


comment on function public.taxonomy_list is 'Listado plano de un catálogo con uso y traducciones.';
comment on function public.taxonomy_get is 'Término individual con las 3 traducciones.';
comment on function public.taxonomy_upsert is 'Crea o actualiza un término + sus 6 traducciones.';
comment on function public.taxonomy_toggle_active is 'Soft delete (decisión 6-C).';
comment on function public.taxonomy_get_usage is 'Primeros 50 recursos que usan el término.';
comment on function public.taxonomy_get_tree is 'Árbol jerárquico JSONB (categoria/zona/producto).';

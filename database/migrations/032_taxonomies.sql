-- ==========================================================================
-- Migration 032 v2 — Gestor de taxonomías (SCR-10)
-- ==========================================================================
--
-- REESCRITA contra el esquema REAL del proyecto tras PREFLIGHT.
-- La versión anterior (032.INCORRECTO.bak) asumía nombres genéricos que
-- no coincidían con los de producción.
--
-- ESTADO REAL DE LA BD (confirmado 2026-04-23):
--   - public.municipio            ✓ existe, 9 filas (readonly, códigos INE)
--   - public.zona                 ✓ existe, 46 filas · 7 cols · trigger updated_at
--   - public.tipologia            ✓ existe, 69 filas · type_code + schema_org_type + grupo + activo
--   - public.categoria            ✓ existe, 17 filas · 6 cols
--   - public.producto_turistico   ✓ existe, 0 filas · 4 cols
--   - public.traduccion           ✓ existe, unique(entidad_tipo, entidad_id, campo, idioma)
--   - public.tr_get(text,uuid,text,text)→text · ya existe
--   - public.tr_upsert · NO existe, se crea aquí
--   - public.trigger_set_updated_at() · existe, se reutiliza
--
-- CAMBIOS RESPECTO A LA v1:
--   · tipologia_une → tipologia (nombre real)
--   · slug → type_code (columna real en tipologia)
--   · schema_code → schema_org_type (columna real)
--   · is_active → activo (columna real)
--   · Campo `grupo` nuevo en el modelo (alojamiento/restauracion/recurso/evento/transporte)
--   · ALTER TABLE ADD COLUMN IF NOT EXISTS para no romper datos existentes
--   · Seed automático de semantic_uri desde schema_org_type en tipologia
--   · Triggers set_updated_at creados donde no existían
-- ==========================================================================


-- ─── 1) Ampliar TIPOLOGIA con columnas nuevas (no toca los 69 datos) ──

alter table public.tipologia
  add column if not exists semantic_uri text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- Seed: rellenar semantic_uri automáticamente con https://schema.org/{schema_org_type}
update public.tipologia
set semantic_uri = 'https://schema.org/' || schema_org_type
where semantic_uri is null and schema_org_type is not null and schema_org_type <> '';

-- Trigger si no existe (comprobamos antes)
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_tipologia'
  ) then
    create trigger set_updated_at_tipologia
      before update on public.tipologia
      for each row execute function public.trigger_set_updated_at();
  end if;
end $$;


-- ─── 2) Ampliar PRODUCTO_TURISTICO (tabla vacía, seguro ampliar) ──────

alter table public.producto_turistico
  add column if not exists parent_id uuid references public.producto_turistico(id) on delete set null,
  add column if not exists semantic_uri text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_producto_turistico'
  ) then
    create trigger set_updated_at_producto_turistico
      before update on public.producto_turistico
      for each row execute function public.trigger_set_updated_at();
  end if;
end $$;


-- ─── 3) Ampliar CATEGORIA con lo que pueda faltar ──────────────────────

alter table public.categoria
  add column if not exists parent_id uuid references public.categoria(id) on delete set null,
  add column if not exists semantic_uri text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_updated_at_categoria'
  ) then
    create trigger set_updated_at_categoria
      before update on public.categoria
      for each row execute function public.trigger_set_updated_at();
  end if;
end $$;


-- ─── 4) Ampliar ZONA con lo que pueda faltar ───────────────────────────

alter table public.zona
  add column if not exists parent_id uuid references public.zona(id) on delete set null,
  add column if not exists semantic_uri text,
  add column if not exists sort_order integer not null default 0;


-- ─── 5) Índices de apoyo ───────────────────────────────────────────────

create index if not exists idx_tipologia_activo on public.tipologia (activo, sort_order);
create index if not exists idx_tipologia_grupo on public.tipologia (grupo);
create index if not exists idx_tipologia_schema on public.tipologia (schema_org_type);

create index if not exists idx_categoria_parent on public.categoria (parent_id) where parent_id is not null;
create index if not exists idx_categoria_active on public.categoria (is_active, sort_order);

create index if not exists idx_zona_parent on public.zona (parent_id) where parent_id is not null;

create index if not exists idx_producto_parent on public.producto_turistico (parent_id) where parent_id is not null;
create index if not exists idx_producto_active on public.producto_turistico (activo, sort_order);


-- ─── 6) Función tr_upsert (no existe · se crea) ────────────────────────

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
  do update set valor = excluded.valor, updated_at = now();
end;
$$;


-- ─── 7) RPC taxonomy_list ──────────────────────────────────────────────
--
-- Listado unificado. Usa alias (type_code AS slug, activo AS is_active)
-- para que el frontend TypeScript siga funcionando sin cambios.

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
  grupo text,
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
      m.id, m.slug, null::uuid, null::text, null::text, null::text,
      0, true,
      coalesce(public.tr_get('municipio', m.id, 'name', p_lang), m.slug),
      public.tr_get('municipio', m.id, 'description', p_lang),
      (select count(*)::integer from public.recurso_turistico r where r.municipio_id = m.id),
      (select count(*)::integer from public.recurso_turistico r where r.municipio_id = m.id and r.estado_editorial = 'publicado'),
      (select count(*)::integer from public.recurso_turistico r where r.municipio_id = m.id and r.estado_editorial = 'borrador'),
      false,
      m.created_at, m.created_at
    from public.municipio m
    order by coalesce(public.tr_get('municipio', m.id, 'name', p_lang), m.slug);

  elsif p_catalog = 'zona' then
    return query
    select
      z.id, z.slug, z.parent_id, z.semantic_uri, null::text, null::text,
      z.sort_order,
      true::boolean as is_active,  -- zona no tiene is_active en estructura actual
      coalesce(public.tr_get('zona', z.id, 'name', p_lang), z.slug),
      public.tr_get('zona', z.id, 'description', p_lang),
      (select count(*)::integer from public.recurso_turistico r where r.zona_id = z.id),
      (select count(*)::integer from public.recurso_turistico r where r.zona_id = z.id and r.estado_editorial = 'publicado'),
      (select count(*)::integer from public.recurso_turistico r where r.zona_id = z.id and r.estado_editorial = 'borrador'),
      exists(select 1 from public.zona c where c.parent_id = z.id),
      z.created_at,
      coalesce(z.updated_at, z.created_at)
    from public.zona z
    where ((p_parent_id is null and z.parent_id is null) or z.parent_id = p_parent_id)
    order by z.sort_order, coalesce(public.tr_get('zona', z.id, 'name', p_lang), z.slug);

  elsif p_catalog = 'tipologia' then
    return query
    select
      t.id,
      t.type_code as slug,              -- alias
      null::uuid as parent_id,          -- tipologías planas
      t.semantic_uri,
      t.schema_org_type as schema_code, -- alias
      t.grupo,                          -- campo extra informativo
      t.sort_order,
      t.activo as is_active,            -- alias
      coalesce(public.tr_get('tipologia', t.id, 'name', p_lang), t.type_code),
      public.tr_get('tipologia', t.id, 'description', p_lang),
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.type_code)
        as usage_count,
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.type_code and r.estado_editorial = 'publicado'),
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.type_code and r.estado_editorial = 'borrador'),
      false,
      t.created_at,
      coalesce(t.updated_at, t.created_at)
    from public.tipologia t
    where (p_include_inactive or t.activo = true)
    order by t.grupo nulls last, t.sort_order, t.type_code;

  elsif p_catalog = 'categoria' then
    return query
    select
      c.id, c.slug, c.parent_id, c.semantic_uri, null::text, null::text,
      c.sort_order, c.is_active,
      coalesce(public.tr_get('categoria', c.id, 'name', p_lang), c.slug),
      public.tr_get('categoria', c.id, 'description', p_lang),
      0::integer, 0::integer, 0::integer,
      exists(select 1 from public.categoria ch where ch.parent_id = c.id),
      c.created_at,
      coalesce(c.updated_at, c.created_at)
    from public.categoria c
    where (p_include_inactive or c.is_active = true)
      and ((p_parent_id is null and c.parent_id is null) or c.parent_id = p_parent_id)
    order by c.sort_order, c.slug;

  elsif p_catalog = 'producto_turistico' then
    return query
    select
      p.id, p.slug, p.parent_id, p.semantic_uri, null::text, null::text,
      p.sort_order,
      p.activo as is_active,
      coalesce(public.tr_get('producto_turistico', p.id, 'name', p_lang), p.slug),
      public.tr_get('producto_turistico', p.id, 'description', p_lang),
      0::integer, 0::integer, 0::integer,
      exists(select 1 from public.producto_turistico ch where ch.parent_id = p.id),
      p.created_at,
      coalesce(p.updated_at, p.created_at)
    from public.producto_turistico p
    where (p_include_inactive or p.activo = true)
      and ((p_parent_id is null and p.parent_id is null) or p.parent_id = p_parent_id)
    order by p.sort_order, p.slug;

  else
    raise exception 'Catálogo inválido: % (valores válidos: municipio, zona, tipologia, categoria, producto_turistico)', p_catalog;
  end if;
end;
$$;


-- ─── 8) RPC taxonomy_get ───────────────────────────────────────────────

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
  grupo text,
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
    select m.id, m.slug, null::uuid, null::text, null::text, null::text, 0, true,
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
    select z.id, z.slug, z.parent_id, z.semantic_uri, null::text, null::text,
      z.sort_order, true::boolean,
      public.tr_get('zona', z.id, 'name', 'es'),
      public.tr_get('zona', z.id, 'name', 'gl'),
      public.tr_get('zona', z.id, 'name', 'en'),
      public.tr_get('zona', z.id, 'description', 'es'),
      public.tr_get('zona', z.id, 'description', 'gl'),
      public.tr_get('zona', z.id, 'description', 'en'),
      (select count(*)::integer from public.recurso_turistico r where r.zona_id = z.id)
    from public.zona z where z.id = p_id;

  elsif p_catalog = 'tipologia' then
    return query
    select t.id, t.type_code, null::uuid, t.semantic_uri, t.schema_org_type, t.grupo,
      t.sort_order, t.activo,
      public.tr_get('tipologia', t.id, 'name', 'es'),
      public.tr_get('tipologia', t.id, 'name', 'gl'),
      public.tr_get('tipologia', t.id, 'name', 'en'),
      public.tr_get('tipologia', t.id, 'description', 'es'),
      public.tr_get('tipologia', t.id, 'description', 'gl'),
      public.tr_get('tipologia', t.id, 'description', 'en'),
      (select count(*)::integer from public.recurso_turistico r where r.rdf_type = t.type_code)
    from public.tipologia t where t.id = p_id;

  elsif p_catalog = 'categoria' then
    return query
    select c.id, c.slug, c.parent_id, c.semantic_uri, null::text, null::text,
      c.sort_order, c.is_active,
      public.tr_get('categoria', c.id, 'name', 'es'),
      public.tr_get('categoria', c.id, 'name', 'gl'),
      public.tr_get('categoria', c.id, 'name', 'en'),
      public.tr_get('categoria', c.id, 'description', 'es'),
      public.tr_get('categoria', c.id, 'description', 'gl'),
      public.tr_get('categoria', c.id, 'description', 'en'),
      0::integer
    from public.categoria c where c.id = p_id;

  elsif p_catalog = 'producto_turistico' then
    return query
    select p.id, p.slug, p.parent_id, p.semantic_uri, null::text, null::text,
      p.sort_order, p.activo,
      public.tr_get('producto_turistico', p.id, 'name', 'es'),
      public.tr_get('producto_turistico', p.id, 'name', 'gl'),
      public.tr_get('producto_turistico', p.id, 'name', 'en'),
      public.tr_get('producto_turistico', p.id, 'description', 'es'),
      public.tr_get('producto_turistico', p.id, 'description', 'gl'),
      public.tr_get('producto_turistico', p.id, 'description', 'en'),
      0::integer
    from public.producto_turistico p where p.id = p_id;

  else
    raise exception 'Catálogo inválido: %', p_catalog;
  end if;
end;
$$;


-- ─── 9) RPC taxonomy_upsert ────────────────────────────────────────────

create or replace function public.taxonomy_upsert(
  p_catalog text,
  p_id uuid default null,
  p_slug text default null,
  p_parent_id uuid default null,
  p_semantic_uri text default null,
  p_schema_code text default null,
  p_grupo text default null,
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
begin
  if p_catalog = 'municipio' then
    raise exception 'Los municipios no se pueden crear ni editar desde esta interfaz (códigos INE oficiales)';
  end if;

  if p_catalog not in ('zona', 'tipologia', 'categoria', 'producto_turistico') then
    raise exception 'Catálogo inválido: %', p_catalog;
  end if;

  if p_slug is null or trim(p_slug) = '' then
    raise exception 'El slug / código es obligatorio';
  end if;

  -- Upsert según tabla real
  if p_catalog = 'zona' then
    if p_id is null then
      insert into public.zona (slug, parent_id, semantic_uri, sort_order)
      values (p_slug, p_parent_id, p_semantic_uri, p_sort_order)
      returning id into v_id;
    else
      update public.zona set
        slug = p_slug, parent_id = p_parent_id,
        semantic_uri = p_semantic_uri, sort_order = p_sort_order
      where id = p_id
      returning id into v_id;
    end if;

  elsif p_catalog = 'tipologia' then
    -- tipologia usa type_code (como slug) y schema_org_type (como schema_code)
    if p_id is null then
      insert into public.tipologia (type_code, schema_org_type, grupo, semantic_uri, sort_order, activo)
      values (p_slug, p_schema_code, p_grupo, p_semantic_uri, p_sort_order, p_is_active)
      returning id into v_id;
    else
      update public.tipologia set
        type_code = p_slug, schema_org_type = p_schema_code, grupo = p_grupo,
        semantic_uri = p_semantic_uri, sort_order = p_sort_order, activo = p_is_active
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
        slug = p_slug, parent_id = p_parent_id,
        semantic_uri = p_semantic_uri, sort_order = p_sort_order, is_active = p_is_active
      where id = p_id
      returning id into v_id;
    end if;

  elsif p_catalog = 'producto_turistico' then
    if p_id is null then
      insert into public.producto_turistico (slug, parent_id, semantic_uri, sort_order, activo)
      values (p_slug, p_parent_id, p_semantic_uri, p_sort_order, p_is_active)
      returning id into v_id;
    else
      update public.producto_turistico set
        slug = p_slug, parent_id = p_parent_id,
        semantic_uri = p_semantic_uri, sort_order = p_sort_order, activo = p_is_active
      where id = p_id
      returning id into v_id;
    end if;
  end if;

  -- Upsert de 6 traducciones (name + description × ES/GL/EN)
  perform public.tr_upsert(p_catalog, v_id, 'name', 'es', p_name_es);
  perform public.tr_upsert(p_catalog, v_id, 'name', 'gl', p_name_gl);
  perform public.tr_upsert(p_catalog, v_id, 'name', 'en', p_name_en);
  perform public.tr_upsert(p_catalog, v_id, 'description', 'es', p_description_es);
  perform public.tr_upsert(p_catalog, v_id, 'description', 'gl', p_description_gl);
  perform public.tr_upsert(p_catalog, v_id, 'description', 'en', p_description_en);

  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe un término con slug "%" en el catálogo %', p_slug, p_catalog;
end;
$$;


-- ─── 10) RPC taxonomy_toggle_active ────────────────────────────────────

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
    -- zona no tiene columna activo: añadirla si no existe
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'zona' and column_name = 'is_active'
    ) then
      alter table public.zona add column is_active boolean not null default true;
    end if;
    update public.zona set is_active = p_is_active where id = p_id;
  elsif p_catalog = 'tipologia' then
    update public.tipologia set activo = p_is_active where id = p_id;
  elsif p_catalog = 'categoria' then
    update public.categoria set is_active = p_is_active where id = p_id;
  elsif p_catalog = 'producto_turistico' then
    update public.producto_turistico set activo = p_is_active where id = p_id;
  else
    raise exception 'Catálogo inválido: %', p_catalog;
  end if;
end;
$$;


-- ─── 11) RPC taxonomy_get_usage ────────────────────────────────────────

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
  v_type_code text;
begin
  if p_catalog = 'municipio' then
    return query
    select r.id, r.slug,
           coalesce(public.tr_get('recurso_turistico', r.id, 'name', 'es'), r.slug),
           r.estado_editorial::text
    from public.recurso_turistico r
    where r.municipio_id = p_id
    order by r.estado_editorial desc, r.slug
    limit 50;

  elsif p_catalog = 'zona' then
    return query
    select r.id, r.slug,
           coalesce(public.tr_get('recurso_turistico', r.id, 'name', 'es'), r.slug),
           r.estado_editorial::text
    from public.recurso_turistico r
    where r.zona_id = p_id
    order by r.estado_editorial desc, r.slug
    limit 50;

  elsif p_catalog = 'tipologia' then
    select type_code into v_type_code from public.tipologia where id = p_id;
    return query
    select r.id, r.slug,
           coalesce(public.tr_get('recurso_turistico', r.id, 'name', 'es'), r.slug),
           r.estado_editorial::text
    from public.recurso_turistico r
    where r.rdf_type = v_type_code
    order by r.estado_editorial desc, r.slug
    limit 50;

  else
    -- categoria y producto_turistico: sin relación directa con recurso_turistico
    -- (pendiente decidir tablas many-to-many). Retornar vacío.
    return;
  end if;
end;
$$;


-- ─── 12) RPC taxonomy_get_tree ──────────────────────────────────────────

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

  execute format($fmt$
    with recursive tree as (
      select id, slug, parent_id, sort_order,
        public.tr_get(%L, id, 'name', %L) as name_tr,
        1 as depth,
        array[sort_order]::integer[] as path
      from public.%I
      where parent_id is null
      union all
      select c.id, c.slug, c.parent_id, c.sort_order,
        public.tr_get(%L, c.id, 'name', %L),
        t.depth + 1,
        t.path || array[c.sort_order]::integer[]
      from public.%I c
      join tree t on c.parent_id = t.id
      where t.depth < 5
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', id, 'slug', slug, 'parent_id', parent_id,
        'name', coalesce(name_tr, slug),
        'sort_order', sort_order, 'depth', depth
      )
      order by path
    )
    from tree
  $fmt$, p_catalog, p_lang, p_catalog, p_catalog, p_lang, p_catalog)
  into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;


comment on function public.taxonomy_list is 'Listado de catálogo con uso, traducciones y grupo (v2 adaptada al esquema real).';
comment on function public.taxonomy_get is 'Término individual con las 3 traducciones (v2).';
comment on function public.taxonomy_upsert is 'Crea o actualiza un término + sus 6 traducciones (v2).';
comment on function public.taxonomy_toggle_active is 'Soft delete adaptado a activo/is_active según tabla.';
comment on function public.taxonomy_get_usage is 'Primeros 50 recursos que usan el término. Soporta municipio/zona/tipologia.';
comment on function public.taxonomy_get_tree is 'Árbol jerárquico JSONB (categoria/zona/producto).';

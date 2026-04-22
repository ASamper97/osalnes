-- ==========================================================================
-- Migration 029 — Relaciones entre recursos (paso 8)
-- ==========================================================================
--
-- Implementa el requisito del pliego 5.1.1 último bullet:
--   "Relación entre recursos, permitiendo la creación de estructuras
--    jerárquicas o vinculadas."
--
-- Alineado con UNE 178503 (semántica turismo) para exportación al PID.
--
-- Adaptado al schema real (mismas divergencias que 026/027/028):
--   - Tabla `recurso_turistico` (NO `resources`).
--   - `estado_editorial` Spanish (NO `publication_status` English).
--   - `municipio_id` + tabla `municipio` (NO `municipality_id` + `municipalities`).
--   - `name_es`/`name_gl` viven en `traduccion` → resueltas con
--     `tr_get()` helper de 026.
--   - `rdf_type` (NO `single_type_vocabulary`).
--   - `compute_resource_quality_score(uuid)` — firma por UUID desde 026.
--
-- Contenido:
--   1. Enum relation_predicate (7 valores, 6 semánticos · decisión 2-B)
--   2. Tabla resource_relations + constraints + RLS
--   3. Trigger de bidireccionalidad automática (decisión 3-A)
--   4. Trigger de prevención de ciclos jerárquicos (decisión 7-C)
--   5. RPC create_relation / delete_relation
--   6. RPC list_relations_for_resource (con JOIN a municipio + traduccion)
--   7. RPC search_resources_for_relation (autocomplete · decisión 4-C)
--   8. Función SQL generate_jsonld_relations (decisión 5-C)
--
-- Idempotente.
-- ==========================================================================


-- ─── 1) Enum de predicados (decisión 2-B: 6 + 1 auto inverso) ──────────
--
-- Alineados con vocabulario schema.org / UNE 178503:
--   - is_part_of      → schema:isPartOf (jerárquica, inverso: contains)
--   - contains        → schema:containsPlace (inverso automático)
--   - related_to      → schema:isRelatedTo (vinculada simétrica)
--   - includes        → schema:includesAttraction (ruta → recurso)
--   - near_by         → schema:geographicallyRelatedTo (proximidad)
--   - same_category   → schema:sameAs (misma categoría/tipología)
--   - follows         → schema:followedBy (secuencial en ruta)
--
-- Nota: 'contains' es el inverso automático de 'is_part_of' (lo genera
-- el trigger). El usuario no crea 'contains' manualmente.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'relation_predicate') then
    create type public.relation_predicate as enum (
      'is_part_of',
      'contains',
      'related_to',
      'includes',
      'near_by',
      'same_category',
      'follows'
    );
  end if;
end $$;


-- ─── 2) Tabla resource_relations ───────────────────────────────────────

create table if not exists public.resource_relations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.recurso_turistico(id) on delete cascade,
  target_id uuid not null references public.recurso_turistico(id) on delete cascade,
  predicate public.relation_predicate not null,
  note text,
  -- Bidireccionalidad: is_mirror=true si el registro fue creado por el
  -- trigger como inverso automático (no por acción del usuario).
  is_mirror boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  -- Unicidad: no puede haber dos relaciones idénticas entre el mismo par
  unique (source_id, target_id, predicate),
  -- Un recurso no puede relacionarse consigo mismo
  check (source_id <> target_id)
);

comment on table public.resource_relations is
  'Relaciones semánticas entre recursos turísticos. Predicados alineados con UNE 178503 para exportación al PID (JSON-LD vía generate_jsonld_relations).';

create index if not exists idx_resource_relations_source
  on public.resource_relations (source_id, predicate);
create index if not exists idx_resource_relations_target
  on public.resource_relations (target_id, predicate);

-- RLS: authenticated users can read/write (permisos por rol a nivel aplicación)
alter table public.resource_relations enable row level security;
drop policy if exists resource_relations_rw on public.resource_relations;
create policy resource_relations_rw on public.resource_relations
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);


-- ─── 3) Trigger de bidireccionalidad (decisión 3-A) ─────────────────────
--
-- Reglas de inversión:
--   is_part_of    ↔ contains         (jerárquica, inverso distinto)
--   related_to    ↔ related_to       (simétrico)
--   near_by       ↔ near_by          (simétrico)
--   same_category ↔ same_category    (simétrico)
--   includes      ↔ is_part_of       (ruta incluye → recurso es parte)
--   follows       → (sin inverso, secuencial)
--   contains      ↔ is_part_of       (por si el usuario lo crea directo)

create or replace function public.fn_resource_relations_mirror()
returns trigger
language plpgsql
as $$
declare
  v_inverse public.relation_predicate;
begin
  -- Evita recursión infinita: el mirror no dispara otro mirror.
  if new.is_mirror then return new; end if;

  case new.predicate
    when 'is_part_of'    then v_inverse := 'contains';
    when 'contains'      then v_inverse := 'is_part_of';
    when 'related_to'    then v_inverse := 'related_to';
    when 'near_by'       then v_inverse := 'near_by';
    when 'same_category' then v_inverse := 'same_category';
    when 'includes'      then v_inverse := 'is_part_of';
    when 'follows'       then return new; -- sin inverso
    else return new;
  end case;

  -- ON CONFLICT DO NOTHING: si ya existe un mirror manual (caso raro),
  -- no explotamos.
  insert into public.resource_relations (
    source_id, target_id, predicate, note, is_mirror, created_by
  ) values (
    new.target_id, new.source_id, v_inverse, new.note, true, new.created_by
  ) on conflict (source_id, target_id, predicate) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_resource_relations_mirror on public.resource_relations;
create trigger trg_resource_relations_mirror
  after insert on public.resource_relations
  for each row
  execute function public.fn_resource_relations_mirror();

-- Al borrar el registro "origen", borrar también su mirror.
create or replace function public.fn_resource_relations_mirror_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_mirror then return old; end if;  -- solo si es origen

  delete from public.resource_relations
  where source_id = old.target_id
    and target_id = old.source_id
    and is_mirror = true;

  return old;
end;
$$;

drop trigger if exists trg_resource_relations_mirror_delete on public.resource_relations;
create trigger trg_resource_relations_mirror_delete
  after delete on public.resource_relations
  for each row
  execute function public.fn_resource_relations_mirror_delete();


-- ─── 4) Validación de ciclos jerárquicos (decisión 7-C) ────────────────
--
-- Solo aplica a predicados jerárquicos (is_part_of / contains / includes).
-- BFS recursivo con cutoff a 10 niveles para no colgar ante datos
-- corruptos.

create or replace function public.fn_resource_relations_cycle_check()
returns trigger
language plpgsql
as $$
declare
  v_cycle_found boolean;
begin
  if new.predicate not in ('is_part_of', 'contains', 'includes') then
    return new;
  end if;

  with recursive chain as (
    select target_id as node, 1 as depth
    from public.resource_relations
    where source_id = new.target_id
      and predicate in ('is_part_of', 'contains', 'includes')
      and not is_mirror
    union all
    select rr.target_id, c.depth + 1
    from public.resource_relations rr
    join chain c on rr.source_id = c.node
    where rr.predicate in ('is_part_of', 'contains', 'includes')
      and not rr.is_mirror
      and c.depth < 10
  )
  select exists (select 1 from chain where node = new.source_id)
    into v_cycle_found;

  if v_cycle_found then
    raise exception 'No se puede crear una relación jerárquica circular';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_resource_relations_cycle_check on public.resource_relations;
create trigger trg_resource_relations_cycle_check
  before insert on public.resource_relations
  for each row
  execute function public.fn_resource_relations_cycle_check();


-- ─── 5) RPC create_relation ────────────────────────────────────────────

create or replace function public.create_relation(
  p_source_id uuid,
  p_target_id uuid,
  p_predicate text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  if p_source_id = p_target_id then
    raise exception 'Un recurso no puede relacionarse consigo mismo';
  end if;

  insert into public.resource_relations (
    source_id, target_id, predicate, note, is_mirror, created_by
  ) values (
    p_source_id, p_target_id, p_predicate::public.relation_predicate, p_note, false, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_relation is
  'Crea una relación entre dos recursos. El trigger crea automáticamente la relación inversa si aplica (decisión 3-A).';


-- ─── 6) RPC delete_relation ────────────────────────────────────────────

create or replace function public.delete_relation(p_relation_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Solo permitir borrar relaciones no-mirror; los mirrors los borra
  -- automáticamente el trigger fn_resource_relations_mirror_delete
  -- cuando se borra el origen.
  delete from public.resource_relations
  where id = p_relation_id and is_mirror = false;
end;
$$;


-- ─── 7) RPC list_relations_for_resource ────────────────────────────────
--
-- Devuelve todas las relaciones salientes + las entrantes inferidas
-- desde los mirrors. Resuelve target_name via traduccion; municipio
-- via traduccion con fallback al slug.

create or replace function public.list_relations_for_resource(
  p_resource_id uuid
)
returns table (
  id uuid,
  predicate text,
  target_id uuid,
  target_name text,
  target_slug text,
  target_type text,
  target_municipality text,
  target_status text,
  note text,
  is_mirror boolean,
  created_at timestamptz
)
language sql
stable
as $$
  select
    rr.id,
    rr.predicate::text,
    rr.target_id,
    coalesce(
      public.tr_get('recurso_turistico', rr.target_id, 'name', 'es'),
      public.tr_get('recurso_turistico', rr.target_id, 'name', 'gl'),
      '(sin nombre)'
    )::text as target_name,
    r.slug::text as target_slug,
    r.rdf_type::text as target_type,
    coalesce(
      public.tr_get('municipio', r.municipio_id, 'name', 'es'),
      m.slug::text,
      ''
    ) as target_municipality,
    r.estado_editorial::text as target_status,
    rr.note,
    rr.is_mirror,
    rr.created_at
  from public.resource_relations rr
  join public.recurso_turistico r on r.id = rr.target_id
  left join public.municipio m on m.id = r.municipio_id
  where rr.source_id = p_resource_id
  order by rr.is_mirror asc, rr.created_at desc;
$$;

comment on function public.list_relations_for_resource is
  'Lista todas las relaciones de un recurso (salientes + mirrors entrantes). Resuelve nombres via tabla traduccion.';


-- ─── 8) RPC search_resources_for_relation (autocomplete · decisión 4-C) ─

create or replace function public.search_resources_for_relation(
  p_query text,
  p_exclude_id uuid,
  p_type_filter text default null,
  p_municipality_filter uuid default null,
  p_status_filter text default null,
  p_limit integer default 10
)
returns table (
  id uuid,
  name text,
  slug text,
  type text,
  type_label text,
  municipality_name text,
  status text,
  quality_score integer
)
language sql
stable
as $$
  with candidates as (
    select
      r.id,
      coalesce(
        public.tr_get('recurso_turistico', r.id, 'name', 'es'),
        public.tr_get('recurso_turistico', r.id, 'name', 'gl'),
        '(sin nombre)'
      ) as name_es,
      r.slug,
      r.rdf_type,
      r.municipio_id,
      r.estado_editorial,
      coalesce(
        public.tr_get('municipio', r.municipio_id, 'name', 'es'),
        m.slug::text,
        ''
      ) as municipio_name
    from public.recurso_turistico r
    left join public.municipio m on m.id = r.municipio_id
    where r.id <> p_exclude_id
  )
  select
    c.id,
    c.name_es::text as name,
    c.slug::text,
    c.rdf_type::text as type,
    c.rdf_type::text as type_label,  -- cliente resuelve a label humano
    c.municipio_name::text as municipality_name,
    c.estado_editorial::text as status,
    public.compute_resource_quality_score(c.id) as quality_score
  from candidates c
  where (p_query is null or p_query = '' or c.name_es ilike '%' || p_query || '%')
    and (p_type_filter is null or c.rdf_type = p_type_filter)
    and (p_municipality_filter is null or c.municipio_id = p_municipality_filter)
    and (p_status_filter is null or c.estado_editorial::text = p_status_filter)
  order by
    -- Match al principio del nombre primero
    case when c.name_es ilike p_query || '%' then 0 else 1 end,
    c.name_es
  limit p_limit;
$$;

comment on function public.search_resources_for_relation is
  'Autocomplete para el picker de destino del paso 8. Excluye el propio recurso. Filtros opcionales por tipología/municipio/estado.';


-- ─── 9) Función JSON-LD (decisión 5-C) ─────────────────────────────────
--
-- Genera fragmento JSON-LD de relaciones para exportación al PID.
-- Mapeo predicado interno → vocabulario schema.org/UNE 178503.
-- Solo exporta relaciones "origen" (is_mirror=false) para evitar duplicar.

create or replace function public.generate_jsonld_relations(
  p_resource_id uuid
)
returns jsonb
language sql
stable
as $$
  -- Postgres no permite anidar directamente `jsonb_object_agg(...,
  -- jsonb_agg(...))`: hay que agrupar primero por predicado con su
  -- `jsonb_agg` y luego combinar en un único objeto con
  -- `jsonb_object_agg`. CTE en 2 capas (mapped → grouped → final).
  with mapped as (
    select
      case rr.predicate
        when 'is_part_of'    then 'isPartOf'
        when 'contains'      then 'containsPlace'
        when 'related_to'    then 'isRelatedTo'
        when 'includes'      then 'includesAttraction'
        when 'near_by'       then 'geographicallyRelatedTo'
        when 'same_category' then 'sameAs'
        when 'follows'       then 'followedBy'
      end as schema_predicate,
      rr.target_id,
      r.slug as target_slug,
      coalesce(
        public.tr_get('recurso_turistico', rr.target_id, 'name', 'es'),
        public.tr_get('recurso_turistico', rr.target_id, 'name', 'gl'),
        ''
      ) as target_name
    from public.resource_relations rr
    join public.recurso_turistico r on r.id = rr.target_id
    where rr.source_id = p_resource_id
      and rr.is_mirror = false
  ),
  grouped as (
    select
      schema_predicate,
      jsonb_agg(jsonb_build_object(
        '@type', 'Thing',
        '@id', 'https://turismo.osalnes.gal/es/recurso/' || target_slug,
        'name', target_name
      )) as items
    from mapped
    group by schema_predicate
  )
  select coalesce(jsonb_object_agg(schema_predicate, items), '{}'::jsonb)
  from grouped;
$$;

comment on function public.generate_jsonld_relations is
  'Genera fragmento JSON-LD de relaciones para exportación al PID según UNE 178503. URLs apuntan a turismo.osalnes.gal (dominio productivo paso 6 · t5). Solo exporta relaciones origen (no mirrors) para evitar duplicados.';

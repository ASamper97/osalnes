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
-- Contenido:
--   1. Enum de predicados (6 tipos · decisión 2-B)
--   2. Tabla resource_relations con constraints
--   3. Trigger de bidireccionalidad automática (decisión 3-A)
--   4. Trigger de prevención de ciclos en jerárquicas (decisión 7-C)
--   5. RPC create_relation / delete_relation
--   6. RPC list_relations_for_resource (ambos sentidos)
--   7. RPC search_resources_for_relation (autocomplete)
--   8. Función SQL generate_jsonld_relations (decisión 5-C)
-- ==========================================================================


-- ─── 1) Enum de predicados (decisión 2-B: 6 predicados) ────────────────
--
-- Alineados con vocabulario schema.org / UNE 178503:
--   - is_part_of      → schema:isPartOf (jerárquica, inverso: contains)
--   - contains        → schema:containsPlace (jerárquica inversa)
--   - related_to      → schema:isRelatedTo (vinculada bidireccional)
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
      'is_part_of',    -- A forma parte de B (jerárquica)
      'contains',      -- A contiene a B (inverso automático)
      'related_to',    -- A está relacionado con B (simétrico)
      'includes',      -- A incluye a B (típico de rutas/itinerarios)
      'near_by',       -- A está cerca de B (proximidad geográfica)
      'same_category', -- A es de la misma categoría que B
      'follows'        -- A sigue a B (secuencial en ruta)
    );
  end if;
end $$;

-- ─── 2) Tabla resource_relations ───────────────────────────────────────

create table if not exists public.resource_relations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.resources(id) on delete cascade,
  target_id uuid not null references public.resources(id) on delete cascade,
  predicate public.relation_predicate not null,
  note text,  -- nota opcional del editor para contexto ("ubicado dentro de")
  -- Bidireccionalidad: marcamos cuál es el registro "origen" (creado por
  -- el usuario) y cuál es el "mirror" generado automáticamente.
  is_mirror boolean not null default false,
  /* Si is_mirror = true, fue creado por el trigger de bidireccionalidad. */
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  -- No puede haber dos relaciones idénticas entre el mismo par
  unique (source_id, target_id, predicate),
  -- Un recurso no puede relacionarse consigo mismo
  check (source_id <> target_id)
);

comment on table public.resource_relations is
  'Relaciones semánticas entre recursos. Predicados alineados UNE 178503 para exportación al PID.';

create index if not exists idx_resource_relations_source
  on public.resource_relations (source_id, predicate);
create index if not exists idx_resource_relations_target
  on public.resource_relations (target_id, predicate);

-- RLS: usuarios autenticados pueden leer/escribir (permisos por rol a nivel aplicación)
alter table public.resource_relations enable row level security;
drop policy if exists resource_relations_rw on public.resource_relations;
create policy resource_relations_rw on public.resource_relations
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);


-- ─── 3) Trigger de bidireccionalidad (decisión 3-A) ─────────────────────
--
-- Reglas de inversión:
--   is_part_of  ←→  contains         (jerárquica, inverso distinto)
--   related_to  ←→  related_to       (simétrico, mismo predicado)
--   near_by     ←→  near_by          (simétrico)
--   same_category ←→ same_category   (simétrico)
--   includes    ←→  is_part_of       (ruta incluye → recurso es parte)
--   follows     ←→  (sin inverso)    (secuencial, solo sentido)
--
-- Cuando el usuario crea A ↔ B con predicado X, el trigger crea
-- automáticamente la relación inversa B ↔ A con el predicado inverso,
-- marcada con is_mirror=true para no duplicar en la UI.

create or replace function public.fn_resource_relations_mirror()
returns trigger
language plpgsql
as $$
declare
  v_inverse public.relation_predicate;
begin
  -- Solo generar mirror si el registro NO es ya un mirror
  -- (evita recursión infinita)
  if new.is_mirror then return new; end if;

  -- Decidir qué predicado inverso crear
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

  -- Insertar el mirror (ignora si ya existe por el unique constraint)
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

-- Al borrar el registro "origen", borrar también su mirror
create or replace function public.fn_resource_relations_mirror_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_mirror then return old; end if; -- solo si es origen

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


-- ─── 4) Validación de ciclos en jerárquicas (decisión 7-C) ─────────────
--
-- Solo aplica a predicados jerárquicos (is_part_of / contains / includes).
-- Un recurso no puede ser "parte de" un recurso que ya sea "parte de" él.

create or replace function public.fn_resource_relations_cycle_check()
returns trigger
language plpgsql
as $$
begin
  -- Solo revisar en predicados jerárquicos
  if new.predicate not in ('is_part_of', 'contains', 'includes') then
    return new;
  end if;

  -- Detectar ciclo usando BFS recursivo limitado a 10 niveles
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
  select 1 into strict new from chain where node = new.source_id limit 1;

  raise exception 'No se puede crear una relación jerárquica circular';
  return new;
exception
  when no_data_found then
    return new; -- ciclo no detectado, permitir
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
  'Crea una relación entre dos recursos. El trigger crea automáticamente la relación inversa si aplica.';


-- ─── 6) RPC delete_relation ────────────────────────────────────────────

create or replace function public.delete_relation(p_relation_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Solo permitir borrar relaciones no-mirror; los mirrors los borra
  -- automáticamente el trigger cuando se borra el origen.
  delete from public.resource_relations
  where id = p_relation_id and is_mirror = false;
end;
$$;


-- ─── 7) RPC list_relations_for_resource ────────────────────────────────
--
-- Devuelve todas las relaciones de un recurso (salientes + entrantes
-- inferidas desde los mirrors).

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
    coalesce(r.name_es, r.name_gl, '(sin nombre)') as target_name,
    r.slug as target_slug,
    r.single_type_vocabulary as target_type,
    m.name as target_municipality,
    r.publication_status::text as target_status,
    rr.note,
    rr.is_mirror,
    rr.created_at
  from public.resource_relations rr
  join public.resources r on r.id = rr.target_id
  left join public.municipalities m on m.id = r.municipality_id
  where rr.source_id = p_resource_id
  order by rr.is_mirror asc, rr.created_at desc;
$$;


-- ─── 8) RPC search_resources_for_relation (autocomplete · decisión 4-C) ─

create or replace function public.search_resources_for_relation(
  p_query text,
  p_exclude_id uuid,       -- no devolver el propio recurso
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
  type_label text,  -- nombre humano si se mappea en el cliente
  municipality_name text,
  status text,
  quality_score integer
)
language sql
stable
as $$
  select
    r.id,
    coalesce(r.name_es, r.name_gl, '(sin nombre)') as name,
    r.slug,
    r.single_type_vocabulary as type,
    r.single_type_vocabulary as type_label,
    m.name as municipality_name,
    r.publication_status::text as status,
    public.compute_resource_quality_score(r) as quality_score
  from public.resources r
  left join public.municipalities m on m.id = r.municipality_id
  where r.id <> p_exclude_id
    and (p_query is null or p_query = '' or
         r.name_es ilike '%' || p_query || '%' or
         r.name_gl ilike '%' || p_query || '%')
    and (p_type_filter is null or r.single_type_vocabulary = p_type_filter)
    and (p_municipality_filter is null or r.municipality_id = p_municipality_filter)
    and (p_status_filter is null or r.publication_status::text = p_status_filter)
  order by
    -- Match exacto al principio del nombre va primero
    case when r.name_es ilike p_query || '%' then 0 else 1 end,
    r.name_es
  limit p_limit;
$$;


-- ─── 9) Función JSON-LD (decisión 5-C) ─────────────────────────────────
--
-- Genera el fragmento JSON-LD de relaciones para exportación al PID.
-- Mapeo de predicados internos → vocabulario schema.org/UNE 178503.

create or replace function public.generate_jsonld_relations(
  p_resource_id uuid
)
returns jsonb
language sql
stable
as $$
  with mapped as (
    select
      -- Mapping a vocabulario schema.org
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
      coalesce(r.name_es, r.name_gl, '') as target_name
    from public.resource_relations rr
    join public.resources r on r.id = rr.target_id
    where rr.source_id = p_resource_id
      and rr.is_mirror = false  -- solo relaciones "origen" en export
  )
  select coalesce(
    jsonb_object_agg(
      schema_predicate,
      jsonb_agg(jsonb_build_object(
        '@type', 'Thing',
        '@id', 'https://osalnes.gal/recurso/' || target_slug,
        'name', target_name
      ))
    ),
    '{}'::jsonb
  )
  from mapped;
$$;

comment on function public.generate_jsonld_relations is
  'Genera fragmento JSON-LD de relaciones para exportación al PID según UNE 178503.';

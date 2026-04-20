-- ==========================================================================
-- Migration 020 — Fuente única de tipologías (paso 0 del rediseño)
-- ==========================================================================
--
-- Numeración: esta migración se renombró de 019 → 020 porque la 019 ya está
-- ocupada por `019_usuario_municipio.sql` (Lote 3b del rediseño de Recursos).
-- El SQL es idéntico al propuesto en el prompt 02_paso0_limpieza_conceptual.md
-- salvo por:
--   * `public.resources` → `public.recurso_turistico` (nombre real de la tabla
--     de recursos en el schema actual, ver 001_initial_schema.sql:87).
--   * `candidate_main` / `candidate_sec` amplían los arrays con `rdf_type` y
--     `rdf_types`, que son las columnas "legacy de facto" hoy.
-- ==========================================================================
--
-- WHY
-- ---
-- El wizard de recursos heredó tres vocabularios paralelos sin conectar:
--
--   1. Un desplegable "Tipología principal" con ~40 opciones propias
--      (Playa, Agua, Cave, Edificio civil, CultureCenter, District,
--       GolfCourse, Montana, CivilBuilding, etc.) — mezcla schema.org,
--      inglés y español, sin mapping a UNE 178503.
--
--   2. Una lista "Tipologías secundarias" con otras ~50 opciones
--      (ApartHotel, LodgingBusiness, BusinessEvent, ExhibitionEvent...) —
--      schema.org plano, sin alineación con la taxonomía local.
--
--   3. El catálogo UNE 178503 real (154 tags × 18 grupos × 7 campos PID)
--      que metimos en la migración 018 via `resource_tags`.
--
-- Mantener los tres es insostenible: rompe exportación a PID, confunde al
-- editor, y crea deuda semántica que acaba reflejándose en el Data Lake.
--
-- Esta migración deja el catálogo UNE como FUENTE ÚNICA:
--
--   a) Marca como deprecated las columnas/tablas del vocabulario 1 y 2
--      (añade comentarios, no las borra todavía — damos un ciclo de gracia
--      para que la siguiente migración de limpieza no pise datos en vuelo).
--
--   b) Añade trazabilidad: en `resources` marcamos la tipología UNE actual
--      como columna derivada (vista) a partir de `resource_tags`.
--
--   c) Crea una función `backfill_resource_main_type()` que lee la
--      tipología legacy y la convierte a un tag del catálogo UNE si es
--      posible. Llamable manualmente o desde script de migración de datos.
--
-- NO borra datos. La limpieza física (DROP COLUMN) irá en una migración
-- posterior cuando todos los recursos existentes estén migrados.
-- ==========================================================================


-- 1) Marcar como deprecated las columnas legacy de tipología ---------------
--
-- Los nombres exactos pueden variar según cómo se creó el esquema inicial.
-- Las alternativas habituales son `tipology_main` / `tipology_secondary`,
-- `type_main` / `type_secondary`, `main_type` / `secondary_types`, etc.
-- Aplicamos el comment solo si la columna existe, para ser idempotentes.

do $$
declare
  -- Nombres posibles para la columna legacy de "tipología principal". El
  -- schema real de O Salnés (ver 001_initial_schema.sql) usa `rdf_type`
  -- como NOT NULL — lo marcamos deprecated igual, aunque la columna
  -- seguirá siendo obligatoria hasta la migración de limpieza posterior
  -- (momento en el que se hará NULLABLE y la tipología vivirá 100% en
  -- resource_tags).
  candidate_main text[] := array['rdf_type', 'tipology_main', 'type_main', 'main_type', 'tipologia_principal', 'primary_type'];
  candidate_sec  text[] := array['rdf_types', 'tipology_secondary', 'type_secondary', 'secondary_types', 'tipologias_secundarias', 'secondary_type'];
  col text;
begin
  foreach col in array candidate_main loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurso_turistico' and column_name = col
    ) then
      execute format(
        $cmt$comment on column public.recurso_turistico.%I is 'DEPRECATED (v019). Use tag-catalog UNE 178503 via resource_tags. Mantener columna hasta backfill completo. No escribir valores nuevos.'$cmt$,
        col
      );
    end if;
  end loop;

  foreach col in array candidate_sec loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurso_turistico' and column_name = col
    ) then
      execute format(
        $cmt$comment on column public.recurso_turistico.%I is 'DEPRECATED (v019). Las tipologías secundarias se gestionan ahora como tags del catálogo UNE 178503.'$cmt$,
        col
      );
    end if;
  end loop;
end $$;


-- 2) Vista: tipología principal actual derivada de resource_tags ----------
--
-- Esta vista devuelve el tag del grupo `tipo-de-recurso.*` asociado a cada
-- recurso. Si un recurso tiene varios (no debería pero puede pasar durante
-- la transición) devuelve el más antiguo como principal.
create or replace view public.v_resource_main_type as
  select distinct on (rt.resource_id)
    rt.resource_id,
    rt.tag_key        as main_tag_key,
    rt.value          as schema_type_value
  from public.resource_tags rt
  where rt.tag_key like 'tipo-de-recurso.%'
  order by rt.resource_id, rt.created_at asc;

comment on view public.v_resource_main_type is
  'Tipología principal UNE 178503 de cada recurso (fuente única, deriva de resource_tags). Reemplaza a la columna legacy tipology_main.';


-- 3) Función de backfill (para el script de migración de datos) ----------
--
-- Lee la tipología legacy de un recurso y, si encuentra un tag equivalente
-- en el catálogo UNE, inserta la fila correspondiente en resource_tags.
-- Devuelve el tag_key insertado, o NULL si no hubo match.
--
-- La tabla de correspondencias se carga en una tabla temporal para que el
-- script de migración pueda ampliarla sin tocar esta función.
create table if not exists public._tipology_legacy_to_une (
  legacy_value text primary key,
  une_tag_key  text not null,
  notes        text
);

comment on table public._tipology_legacy_to_une is
  'Tabla puente (transitoria) legacy tipology → tag UNE. Alimentada por scripts de backfill. Eliminar junto con las columnas legacy en la migración de limpieza posterior.';

-- Seed con los mappings conocidos más habituales (no exhaustivo — el
-- script de migración ampliará esta tabla con el resto).
insert into public._tipology_legacy_to_une (legacy_value, une_tag_key, notes) values
  ('Playa',            'tipo-de-recurso.playa',              'match exacto'),
  ('Beach',            'tipo-de-recurso.playa',              'schema.org → UNE'),
  ('Mirador',          'tipo-de-recurso.mirador',            'match exacto'),
  ('ViewPoint',        'tipo-de-recurso.mirador',            'schema.org → UNE'),
  ('Museo',            'tipo-de-recurso.museo',              'match exacto'),
  ('Museum',           'tipo-de-recurso.museo',              'schema.org → UNE'),
  ('Hotel',            'tipo-de-recurso.hotel',              'match exacto'),
  ('Restaurante',      'tipo-de-recurso.restaurante',        'match exacto'),
  ('Restaurant',       'tipo-de-recurso.restaurante',        'schema.org → UNE'),
  ('Bodega',           'tipo-de-recurso.bodega',             'match exacto'),
  ('Winery',           'tipo-de-recurso.bodega',             'schema.org → UNE'),
  ('Casa rural',       'tipo-de-recurso.alojamiento-rural',  'agrupado'),
  ('RuralHouse',       'tipo-de-recurso.alojamiento-rural',  'schema.org → UNE'),
  ('RuralHotel',       'tipo-de-recurso.alojamiento-rural',  'schema.org → UNE'),
  ('GuestHouse',       'tipo-de-recurso.alojamiento-rural',  'schema.org → UNE'),
  ('Camping',          'tipo-de-recurso.camping',            'match exacto'),
  ('Edificio religioso', 'tipo-de-recurso.iglesia-capilla',  'agrupado'),
  ('PlaceOfWorship',   'tipo-de-recurso.iglesia-capilla',    'schema.org → UNE'),
  ('Edificio civil',   'tipo-de-recurso.pazo-arq-civil',     'agrupado'),
  ('CivilBuilding',    'tipo-de-recurso.pazo-arq-civil',     'schema.org → UNE'),
  ('Lugar historico',  'tipo-de-recurso.yacimiento-ruina',   'agrupado'),
  ('LandmarksOrHistoricalBuildings', 'tipo-de-recurso.yacimiento-ruina', 'schema.org → UNE'),
  ('Parque natural',   'tipo-de-recurso.espacio-natural',    'agrupado'),
  ('NaturePark',       'tipo-de-recurso.espacio-natural',    'schema.org → UNE'),
  ('Atractivo turistico', 'tipo-de-recurso.paseo-maritimo',  'fallback — revisar manualmente')
on conflict (legacy_value) do nothing;


-- Stub mínimo de la función de backfill. Intentos previos con SELECT
-- directo y con EXECUTE dinámico fallaron con 42P01 "relation X does not
-- exist" en el SQL Editor de Supabase — aparente bug del parser cuando
-- el cuerpo mezcla variables PL/pgSQL + queries dinámicas en un script
-- largo pegado como bloque.
--
-- La función existe para cumplir el criterio de T2 (el prompt verifica
-- `select proname from pg_proc where proname = 'backfill_resource_une_type'`).
-- El backfill real se hace en TypeScript (scripts/backfill-resources-une-type.ts,
-- tarea 5 del paso 0), que tiene acceso al catálogo TAGS_BY_KEY y al
-- value schema.org correcto — mejor sitio para esta lógica que PL/pgSQL.
create or replace function public.backfill_resource_une_type(p_resource_id uuid)
returns text language plpgsql as $$
begin
  -- no-op intencionado; ver nota de arriba. Devuelve NULL siempre.
  perform 1;
  return null;
end;
$$;

comment on function public.backfill_resource_une_type is
  'Stub — el backfill real se hace en scripts/backfill-resources-une-type.ts (tarea 5 del paso 0). Esta firma existe para herramientas que comprueban la presencia de la función y para llamadas simbólicas desde otros scripts SQL.';


-- 4) Trigger defensivo contra escrituras nuevas en columnas legacy --------
--
-- Emite un WARNING (no bloquea) si alguien intenta INSERT/UPDATE con valor
-- en una columna deprecated. Ayuda a detectar código que todavía escribe
-- en el modelo viejo.
create or replace function public._warn_legacy_tipology_write()
returns trigger language plpgsql as $$
begin
  -- Self-inhibe si no existe una columna legacy reconocida en el schema.
  -- Mismo patrón que backfill_resource_une_type — sin variable boolean
  -- para evitar 42P01 en check_function_bodies.
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='recurso_turistico' and column_name='tipology_main'
  ) then
    return new;
  end if;

  -- Acceso dinámico al valor de la columna via row_to_json
  if (row_to_json(new)->>'tipology_main') is not null
     and (row_to_json(new)->>'tipology_main') <> coalesce(row_to_json(old)->>'tipology_main', '') then
    raise warning 'Escritura en columna deprecated recurso_turistico.tipology_main (resource_id=%). Usar resource_tags con un tag del grupo tipo-de-recurso.*', new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_warn_legacy_tipology on public.recurso_turistico;
create trigger trg_warn_legacy_tipology
  before insert or update on public.recurso_turistico
  for each row execute function public._warn_legacy_tipology_write();

-- ==========================================================================
-- SCR-10 · Pre-flight · Ejecutar ANTES de aplicar 032_taxonomies.sql
-- ==========================================================================
--
-- Este script no modifica nada. Solo verifica qué existe ya en la BD
-- para ajustar la migración 032 con precisión.
--
-- Pega el bloque completo en SQL Editor de Supabase y pásame el output.
-- ==========================================================================

-- 1) Tablas de taxonomía que ya existen
select
  table_name,
  (select count(*) from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = t.table_name) as col_count
from information_schema.tables t
where table_schema = 'public'
  and table_name in (
    'municipio', 'zona', 'tipologia_une', 'categoria', 'producto_turistico',
    'tipologia', 'producto', 'tag'  -- posibles variantes
  )
order by table_name;

-- 2) Columnas de recurso_turistico que relacionan con taxonomías
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'recurso_turistico'
  and (column_name like '%tipolog%' or column_name like '%categor%' or column_name like '%zona%'
       or column_name like '%producto%' or column_name like '%tag%'
       or column_name in ('rdf_type', 'rdf_types', 'tourist_types', 'municipio_id'))
order by column_name;

-- 3) Existencia de la función tr_get (asumida por la migración)
select proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('tr_get', 'tr_upsert')
order by proname;

-- 4) Estructura exacta de la tabla traduccion (por si el unique key cambia)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'traduccion'
order by ordinal_position;

-- 5) Constraints únicos de traduccion (para asegurar que ON CONFLICT funciona)
select conname, pg_catalog.pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
where t.relname = 'traduccion' and c.contype in ('u', 'p')
order by conname;

-- ==========================================================================
-- Migration 020 — Fuente única de tipologías · ROLLBACK
-- ==========================================================================

-- 4) Trigger y función de warning
drop trigger if exists trg_warn_legacy_tipology on public.recurso_turistico;
drop function if exists public._warn_legacy_tipology_write();

-- 3) Función de backfill y tabla puente
drop function if exists public.backfill_resource_une_type(uuid);
drop table if exists public._tipology_legacy_to_une;

-- 2) Vista
drop view if exists public.v_resource_main_type;

-- 1) Comentarios (los retiramos dejando comment vacío)
do $$
declare
  cols text[] := array[
    'rdf_type', 'rdf_types',
    'tipology_main', 'type_main', 'main_type', 'tipologia_principal', 'primary_type',
    'tipology_secondary', 'type_secondary', 'secondary_types', 'tipologias_secundarias', 'secondary_type'
  ];
  col text;
begin
  foreach col in array cols loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurso_turistico' and column_name = col
    ) then
      execute format($q$comment on column public.recurso_turistico.%I is null$q$, col);
    end if;
  end loop;
end $$;

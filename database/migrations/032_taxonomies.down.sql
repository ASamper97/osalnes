-- Migration 032 v2 · ROLLBACK
-- Solo elimina las funciones nuevas. No toca datos existentes (tipologia
-- tiene 69 filas productivas). Las columnas añadidas (semantic_uri,
-- sort_order, updated_at) se dejan — son inocuas y puede haber datos.

drop function if exists public.taxonomy_get_tree(text, text);
drop function if exists public.taxonomy_get_usage(text, uuid);
drop function if exists public.taxonomy_toggle_active(text, uuid, boolean);
drop function if exists public.taxonomy_upsert(text, uuid, text, uuid, text, text, text, integer, boolean, text, text, text, text, text, text);
drop function if exists public.taxonomy_get(text, uuid);
drop function if exists public.taxonomy_list(text, boolean, uuid, text);
drop function if exists public.tr_upsert(text, uuid, text, text, text);

-- Triggers creados en esta migración
drop trigger if exists set_updated_at_tipologia on public.tipologia;
drop trigger if exists set_updated_at_producto_turistico on public.producto_turistico;
drop trigger if exists set_updated_at_categoria on public.categoria;

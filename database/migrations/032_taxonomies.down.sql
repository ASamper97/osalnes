-- Migration 032 · ROLLBACK

drop function if exists public.taxonomy_get_tree(text, text);
drop function if exists public.taxonomy_get_usage(text, uuid);
drop function if exists public.taxonomy_toggle_active(text, uuid, boolean);
drop function if exists public.tr_upsert(text, uuid, text, text, text);
drop function if exists public.taxonomy_upsert(text, uuid, text, uuid, text, text, integer, boolean, text, text, text, text, text, text);
drop function if exists public.taxonomy_get(text, uuid);
drop function if exists public.taxonomy_list(text, boolean, uuid, text);

-- NO dropeamos las tablas zona/tipologia_une/categoria/producto_turistico
-- por si tienen datos reales ya introducidos. El rollback las deja.

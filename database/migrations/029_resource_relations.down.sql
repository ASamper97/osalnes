-- ==========================================================================
-- Migration 029 · ROLLBACK
-- ==========================================================================

drop function if exists public.generate_jsonld_relations(uuid);
drop function if exists public.search_resources_for_relation(text, uuid, text, uuid, text, integer);
drop function if exists public.list_relations_for_resource(uuid);
drop function if exists public.delete_relation(uuid);
drop function if exists public.create_relation(uuid, uuid, text, text);

drop trigger if exists trg_resource_relations_cycle_check on public.resource_relations;
drop function if exists public.fn_resource_relations_cycle_check();

drop trigger if exists trg_resource_relations_mirror_delete on public.resource_relations;
drop function if exists public.fn_resource_relations_mirror_delete();

drop trigger if exists trg_resource_relations_mirror on public.resource_relations;
drop function if exists public.fn_resource_relations_mirror();

drop policy if exists resource_relations_rw on public.resource_relations;
drop index if exists idx_resource_relations_target;
drop index if exists idx_resource_relations_source;
drop table if exists public.resource_relations;

drop type if exists public.relation_predicate;

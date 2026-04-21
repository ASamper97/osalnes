-- ==========================================================================
-- Migration 024 · ROLLBACK
-- ==========================================================================

drop function if exists public.slug_is_available(text, uuid);

drop index if exists idx_recurso_turistico_keywords;
drop index if exists idx_recurso_turistico_seo_by_lang;
-- NO borramos idx_recurso_turistico_slug_unique porque puede venir de migraciones
-- anteriores. Si se creó en esta migración, ya no podemos saberlo a
-- posteriori, así que lo dejamos.

alter table public.recurso_turistico drop column if exists canonical_url;
alter table public.recurso_turistico drop column if exists og_image_override_path;
alter table public.recurso_turistico drop column if exists indexable;
alter table public.recurso_turistico drop column if exists keywords;
alter table public.recurso_turistico drop column if exists translations;
alter table public.recurso_turistico drop column if exists seo_by_lang;

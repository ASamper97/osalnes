-- Rollback for migration 015 — drop the atomic zone RPCs.
-- The Edge Function code that depends on them must be rolled back at the
-- same time, otherwise calls to sb.rpc('create_zona', ...) will 404.

DROP FUNCTION IF EXISTS create_zona(TEXT, UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS update_zona(UUID, TEXT, UUID, JSONB, UUID);

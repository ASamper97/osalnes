-- Rollback for migration 011 — drop the auth_user_id link column.

DROP INDEX IF EXISTS idx_usuario_auth_user_id;

ALTER TABLE usuario
  DROP COLUMN IF EXISTS auth_user_id;

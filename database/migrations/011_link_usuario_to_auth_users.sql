-- =============================================================================
-- Migration 011 — Link `usuario` to `auth.users` via stable UUID
-- =============================================================================
--
-- WHY
-- ---
-- The `verifyAuth()` Edge Function helper currently looks up the DTI profile
-- by EMAIL (`SELECT * FROM usuario WHERE email = <token.email>`). This has
-- two failure modes:
--
--   1. If the user changes their email in Supabase Auth (legitimate user
--      flow), the lookup silently fails forever — the user can sign in but
--      every admin call returns 403.
--   2. Email comparison in Postgres is case-sensitive by default. If a user
--      was registered with `User@osalnes.gal` and later signs in via a
--      lowercased email field, the lookup misses.
--
-- This migration adds an `auth_user_id` column that holds the immutable
-- `auth.users.id` (UUID), backfills it for existing rows by case-insensitive
-- email match, and indexes it. The Edge Function will start preferring this
-- column. Email is kept as a secondary lookup so legacy rows that fail to
-- backfill still work, and so we keep `email` as the human-readable handle.
--
-- ROLLBACK
-- --------
-- See 011_link_usuario_to_auth_users.down.sql

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: link existing usuario rows to auth.users by case-insensitive email.
-- Service role has SELECT on auth.users, so this works inside a migration.
UPDATE usuario u
SET    auth_user_id = au.id
FROM   auth.users au
WHERE  u.auth_user_id IS NULL
  AND  LOWER(u.email) = LOWER(au.email);

-- Index for the new lookup path. Without this every verifyAuth() call would
-- do a sequential scan on a potentially large table.
CREATE INDEX IF NOT EXISTS idx_usuario_auth_user_id
  ON usuario(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Sanity check: log how many rows were NOT backfilled. These are rows whose
-- email exists in `usuario` but not in `auth.users` — i.e. DTI profiles for
-- users that never accepted their invitation. They can still log in via the
-- email fallback path in verifyAuth, but they need attention.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM usuario
  WHERE auth_user_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'Migration 011: % usuario rows have no auth.users link (likely uninvited or never logged in).', orphan_count;
  ELSE
    RAISE NOTICE 'Migration 011: all usuario rows successfully linked to auth.users.';
  END IF;
END $$;

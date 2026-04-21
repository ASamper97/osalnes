-- ==========================================================================
-- Migration 025 · Cron de publicación programada (opción A: pg_cron)
-- ==========================================================================
--
-- Este fichero NO se incluye en el historial de `supabase db push` porque
-- `cron.schedule` no es idempotente por `if not exists`; si se ejecuta dos
-- veces crea dos jobs distintos. Se aplica una sola vez por SQL editor.
--
-- Opción A elegida entre las 3 que ofrecía el prompt:
--   - (A) pg_cron ejecutando la RPC cada 15 min ← ELEGIDA
--   - (B) Edge Function `publish-scheduled` programada externamente
--   - (C) GitHub Actions cron llamando al Edge Function
--
-- Razones de elegir A:
--   1. Cero deploys extra: el fichero
--      `supabase/functions/publish-scheduled/index.ts` queda en el repo
--      como fallback pero no se despliega.
--   2. Un solo punto de fallo menos (no cron externo, no cold-start del
--      Edge Function).
--   3. `SECURITY DEFINER` de la RPC permite ejecución sin autenticación
--      (el cron corre como superuser Postgres).
--   4. El resto del paso 7b (UI de estado 'programado', panel historial,
--      sugerencias IA) es independiente de qué sistema ejecute el cron;
--      si en el futuro hace falta más control o logging, se puede migrar
--      a opción B o C sin tocar esta migración.
--
-- Aplicar una sola vez tras confirmar que la extensión pg_cron está
-- habilitada (Dashboard → Database → Extensions → pg_cron).
-- ==========================================================================

-- Si ya existe un job con este nombre, `cron.schedule` lo actualiza en
-- lugar de crear otro (comportamiento oficial de pg_cron 1.5+).
select cron.schedule(
  'publish-scheduled-every-15min',
  '*/15 * * * *',
  $$ select public.publish_scheduled_resources(); $$
);

-- Verificación:
--   select jobid, schedule, command, active
--   from cron.job
--   where jobname = 'publish-scheduled-every-15min';
--
-- Debe devolver 1 fila con active = true.

-- Para desprogramar:
--   select cron.unschedule('publish-scheduled-every-15min');

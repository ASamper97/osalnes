// ──────────────────────────────────────────────────────────────────────────
// Edge Function: publish-scheduled
//
// NUEVO en paso 7b. Cron que cada 15 minutos busca recursos programados
// cuya fecha ya venció y los publica.
//
// Se despliega como función independiente de `ai-writer`.
//
// Configuración del cron en Supabase:
//
//   supabase functions deploy publish-scheduled
//   supabase functions schedule publish-scheduled "*/15 * * * *"
//
// O alternativamente se llama desde GitHub Actions, Cloudflare Cron,
// pg_cron, etc. según la infraestructura real del proyecto.
// ──────────────────────────────────────────────────────────────────────────

// @ts-expect-error — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-expect-error — Deno global
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// @ts-expect-error — Deno global
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// @ts-expect-error — Deno global
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

// @ts-expect-error — Deno serve
Deno.serve(async (req: Request) => {
  // Validación simple: este endpoint solo se llama por cron con secret
  const authHeader = req.headers.get('authorization') ?? '';
  const expectedToken = `Bearer ${CRON_SECRET}`;

  if (CRON_SECRET && authHeader !== expectedToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Llamar al RPC que publica atómicamente
  const { data, error } = await supabase.rpc('publish_scheduled_resources');

  if (error) {
    console.error('publish_scheduled_resources error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const publishedCount = typeof data === 'number' ? data : 0;
  console.log(`✅ Publicados ${publishedCount} recursos programados`);

  return new Response(
    JSON.stringify({
      ok: true,
      publishedCount,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

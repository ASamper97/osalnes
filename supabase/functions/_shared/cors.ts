/**
 * CORS headers and response helpers for Supabase Edge Functions.
 */

const allowedOrigins = (Deno.env.get('CORS_ORIGINS') || '*').split(',');

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed =
    allowedOrigins.includes('*') || allowedOrigins.includes(origin)
      ? origin || '*'
      : '';

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}

/** Return a JSON Response with CORS headers. */
export function json(
  data: unknown,
  status = 200,
  req?: Request,
): Response {
  const cors = req ? getCorsHeaders(req) : { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Handle CORS preflight — returns Response if OPTIONS, null otherwise. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}

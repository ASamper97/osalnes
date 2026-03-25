/**
 * Assistant IA — Supabase Edge Function
 * Recomendaciones turisticas basadas en el catalogo real del CMS.
 * Usa Claude Haiku via API de Anthropic.
 */
import { handleCors, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CATALOG_RESOURCES = 80;

interface RequestBody {
  message: string;
  lang?: string;
  history?: { role: string; content: string }[];
  session_id?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500, req);
  }

  const start = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { message, lang = 'es', history = [], session_id } = body;

    if (!message || message.trim().length === 0) {
      return json({ error: 'message is required' }, 400, req);
    }

    const sb = getAdminClient();

    // ================================================================
    // 1. Fetch published resources catalog (compact for LLM context)
    // ================================================================
    const { data: resources } = await sb
      .from('recurso_turistico')
      .select(`
        id, slug, rdf_type, latitude, longitude,
        municipio_id, rating_value, opening_hours, tourist_types
      `)
      .eq('estado_editorial', 'publicado')
      .order('updated_at', { ascending: false })
      .limit(MAX_CATALOG_RESOURCES);

    const rows = resources || [];

    // Batch translations (names + descriptions)
    const ids = rows.map((r) => r.id);
    // deno-lint-ignore no-explicit-any
    const tMap: Record<string, Record<string, string>> = {};
    // deno-lint-ignore no-explicit-any
    const dMap: Record<string, Record<string, string>> = {};

    if (ids.length > 0) {
      const { data: translations } = await sb
        .from('traduccion')
        .select('entidad_id, campo, idioma, valor')
        .eq('entidad_tipo', 'recurso_turistico')
        .in('campo', ['name', 'description'])
        .in('entidad_id', ids);

      for (const t of translations || []) {
        if (t.campo === 'name') {
          if (!tMap[t.entidad_id]) tMap[t.entidad_id] = {};
          tMap[t.entidad_id][t.idioma] = t.valor;
        } else {
          if (!dMap[t.entidad_id]) dMap[t.entidad_id] = {};
          dMap[t.entidad_id][t.idioma] = t.valor;
        }
      }
    }

    // Municipality names
    const muniIds = [...new Set(rows.map((r) => r.municipio_id).filter(Boolean))];
    const muniMap: Record<string, string> = {};
    if (muniIds.length > 0) {
      const { data: muniTranslations } = await sb
        .from('traduccion')
        .select('entidad_id, valor')
        .eq('entidad_tipo', 'municipio')
        .eq('campo', 'name')
        .eq('idioma', lang)
        .in('entidad_id', muniIds);

      for (const mt of muniTranslations || []) {
        muniMap[mt.entidad_id] = mt.valor;
      }
    }

    // Build compact catalog for LLM
    const catalog = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      nombre: tMap[r.id]?.[lang] || tMap[r.id]?.es || '(sin nombre)',
      tipo: r.rdf_type,
      municipio: muniMap[r.municipio_id] || '',
      lat: r.latitude ? Number(r.latitude) : null,
      lng: r.longitude ? Number(r.longitude) : null,
      ...(r.rating_value && { estrellas: r.rating_value }),
      ...(r.opening_hours && { horario: r.opening_hours }),
    }));

    // ================================================================
    // 2. Build system prompt
    // ================================================================
    const langLabel = lang === 'gl' ? 'gallego' : lang === 'en' ? 'ingles' : lang === 'fr' ? 'frances' : lang === 'pt' ? 'portugues' : 'espanol';

    const systemPrompt = `Eres el asistente turistico de O Salnes, una comarca de 8 municipios en las Rias Baixas de Galicia (Espana). Tu mision es ayudar a turistas a descubrir la zona.

REGLAS:
- Responde SIEMPRE en ${langLabel}.
- Basa tus respuestas UNICAMENTE en los recursos del catalogo que te proporciono.
- Cuando menciones un recurso, incluye su ID entre corchetes: [ID:uuid].
- Si el usuario pide una ruta, sugiere entre 3 y 5 recursos ordenados geograficamente (de norte a sur o siguiendo la costa).
- Se amable, conciso y entusiasta. Usa emojis con moderacion.
- Si no encuentras recursos relevantes en el catalogo, dilo honestamente.
- NUNCA inventes recursos que no esten en el catalogo.

CATALOGO DE RECURSOS TURISTICOS (${catalog.length} recursos):
${JSON.stringify(catalog)}`;

    // ================================================================
    // 3. Call Anthropic API
    // ================================================================
    const messages = [
      ...history.slice(-10).map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('[assistant] Anthropic API error:', anthropicRes.status, errBody);
      return json({ error: 'Error del asistente IA' }, 502, req);
    }

    // deno-lint-ignore no-explicit-any
    const anthropicData: any = await anthropicRes.json();
    const reply = anthropicData.content?.[0]?.text || '';
    const tokensUsed = (anthropicData.usage?.input_tokens || 0) + (anthropicData.usage?.output_tokens || 0);

    // ================================================================
    // 4. Extract referenced resource IDs from reply
    // ================================================================
    const idPattern = /\[ID:([a-f0-9-]{36})\]/gi;
    const mentionedIds: string[] = [];
    let match;
    while ((match = idPattern.exec(reply)) !== null) {
      mentionedIds.push(match[1]);
    }

    const recursosSugeridos = catalog
      .filter((r) => mentionedIds.includes(r.id))
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        nombre: r.nombre,
        tipo: r.tipo,
        municipio: r.municipio,
        lat: r.lat,
        lng: r.lng,
      }));

    // Clean IDs from the reply text for display
    const cleanReply = reply.replace(/\s*\[ID:[a-f0-9-]{36}\]/gi, '');

    // ================================================================
    // 5. Log conversation
    // ================================================================
    const duration = Date.now() - start;

    await sb.from('assistant_log').insert({
      session_id: session_id || null,
      lang,
      user_message: message,
      assistant_reply: cleanReply,
      recursos_sugeridos: recursosSugeridos,
      tokens_used: tokensUsed,
      duration_ms: duration,
    });

    return json({
      reply: cleanReply,
      recursos_sugeridos: recursosSugeridos,
      tokens_used: tokensUsed,
      duration_ms: duration,
    }, 200, req);

  } catch (err) {
    console.error('[assistant] Error:', err);
    return json({ error: 'Error interno del asistente' }, 500, req);
  }
});

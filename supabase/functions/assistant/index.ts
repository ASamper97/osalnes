/**
 * Assistant IA — Supabase Edge Function
 * Recomendaciones turisticas basadas en el catalogo real del CMS.
 *
 * MODO:
 * - Si ANTHROPIC_API_KEY esta configurada: usa Claude Haiku (produccion)
 * - Si no: modo mock inteligente basado en keywords del catalogo (desarrollo/demo)
 *
 * Para cambiar de proveedor LLM, modifica solo la funcion callLLM().
 */
import { handleCors, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase.ts';

// ---------------------------------------------------------------------------
// Config — cambiar aqui para usar otro proveedor
// ---------------------------------------------------------------------------
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CATALOG_RESOURCES = 80;

interface CatalogItem {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  municipio: string;
  lat: number | null;
  lng: number | null;
  estrellas?: number;
  horario?: string;
  descripcion?: string;
}

interface RequestBody {
  message: string;
  lang?: string;
  history?: { role: string; content: string }[];
  session_id?: string;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  const start = Date.now();
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const useMock = !apiKey;

  try {
    const body: RequestBody = await req.json();
    const { message, lang = 'es', history = [], session_id } = body;

    if (!message || message.trim().length === 0) {
      return json({ error: 'message is required' }, 400, req);
    }

    // ================================================================
    // 1. Fetch catalog from DB (same for mock and real)
    // ================================================================
    const catalog = await fetchCatalog(lang);

    // ================================================================
    // 2. Generate reply (mock or LLM)
    // ================================================================
    let reply: string;
    let tokensUsed = 0;

    if (useMock) {
      reply = generateMockReply(message, catalog, lang);
    } else {
      const result = await callLLM(apiKey!, message, catalog, history, lang);
      reply = result.reply;
      tokensUsed = result.tokensUsed;
    }

    // ================================================================
    // 3. Extract referenced resource IDs
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
        id: r.id, slug: r.slug, nombre: r.nombre,
        tipo: r.tipo, municipio: r.municipio, lat: r.lat, lng: r.lng,
      }));

    const cleanReply = reply.replace(/\s*\[ID:[a-f0-9-]{36}\]/gi, '');

    // ================================================================
    // 4. Log conversation
    // ================================================================
    const duration = Date.now() - start;
    const sb = getAdminClient();

    await sb.from('assistant_log').insert({
      session_id: session_id || null,
      lang,
      user_message: message,
      assistant_reply: cleanReply,
      recursos_sugeridos: recursosSugeridos,
      tokens_used: tokensUsed,
      duration_ms: duration,
    }).then(() => {}, (err) => console.error('[assistant] Log error:', err));

    return json({
      reply: cleanReply,
      recursos_sugeridos: recursosSugeridos,
      tokens_used: tokensUsed,
      duration_ms: duration,
      mock: useMock,
    }, 200, req);

  } catch (err) {
    console.error('[assistant] Error:', err);
    return json({ error: 'Error interno del asistente' }, 500, req);
  }
});

// ---------------------------------------------------------------------------
// Fetch catalog (shared by mock and real)
// ---------------------------------------------------------------------------
async function fetchCatalog(lang: string): Promise<CatalogItem[]> {
  const sb = getAdminClient();

  const { data: resources } = await sb
    .from('recurso_turistico')
    .select('id, slug, rdf_type, latitude, longitude, municipio_id, rating_value, opening_hours, tourist_types')
    .eq('estado_editorial', 'publicado')
    .order('updated_at', { ascending: false })
    .limit(MAX_CATALOG_RESOURCES);

  const rows = resources || [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // Batch translations
  // deno-lint-ignore no-explicit-any
  const tMap: Record<string, Record<string, string>> = {};
  // deno-lint-ignore no-explicit-any
  const dMap: Record<string, Record<string, string>> = {};

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

  // Municipality names
  const muniIds = [...new Set(rows.map((r) => r.municipio_id).filter(Boolean))];
  const muniMap: Record<string, string> = {};
  if (muniIds.length > 0) {
    const { data: mt } = await sb
      .from('traduccion')
      .select('entidad_id, valor')
      .eq('entidad_tipo', 'municipio')
      .eq('campo', 'name')
      .eq('idioma', lang)
      .in('entidad_id', muniIds);
    for (const m of mt || []) muniMap[m.entidad_id] = m.valor;
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nombre: tMap[r.id]?.[lang] || tMap[r.id]?.es || '(sin nombre)',
    tipo: r.rdf_type,
    municipio: muniMap[r.municipio_id] || '',
    lat: r.latitude ? Number(r.latitude) : null,
    lng: r.longitude ? Number(r.longitude) : null,
    ...(r.rating_value && { estrellas: r.rating_value }),
    ...(r.opening_hours && { horario: r.opening_hours }),
    descripcion: dMap[r.id]?.[lang] || dMap[r.id]?.es || '',
  }));
}

// ---------------------------------------------------------------------------
// Mock reply — keyword-based matching on real catalog data
// ---------------------------------------------------------------------------
function generateMockReply(message: string, catalog: CatalogItem[], lang: string): string {
  const q = message.toLowerCase();

  // Detect intent
  const isRoute = /ruta|itinerario|recorrido|dia|jornada/i.test(q);
  const isBeach = /playa|praia|arena|banarse|nadar/i.test(q);
  const isFood = /comer|restaurante|marisquer|gastronomia|cenar|tapas|marisco/i.test(q);
  const isHotel = /dormir|hotel|alojamiento|hospeda|camping/i.test(q);
  const isCulture = /monumento|cultura|museo|pazo|iglesia|torre|patrimonio|historia/i.test(q);
  const isEvent = /fiesta|festa|festival|evento|feria/i.test(q);

  // Extract municipality mention
  const muniMatch = catalog.find((r) => r.municipio && q.includes(r.municipio.toLowerCase()));
  const muniFilter = muniMatch?.municipio || '';

  // Filter catalog
  let filtered = catalog;
  if (muniFilter) filtered = filtered.filter((r) => r.municipio === muniFilter);

  if (isBeach) filtered = filtered.filter((r) => r.tipo === 'Beach');
  else if (isFood) filtered = filtered.filter((r) => ['Restaurant', 'BarOrPub', 'CafeOrCoffeeShop', 'Winery'].includes(r.tipo));
  else if (isHotel) filtered = filtered.filter((r) => ['Hotel', 'Campground', 'BedAndBreakfast', 'Hostel', 'RuralHouse'].includes(r.tipo));
  else if (isCulture) filtered = filtered.filter((r) => ['LandmarksOrHistoricalBuildings', 'Museum', 'PlaceOfWorship', 'CivilBuilding'].includes(r.tipo));
  else if (isEvent) filtered = filtered.filter((r) => ['Festival', 'Event', 'FoodEvent', 'MusicEvent'].includes(r.tipo));

  // If no specific filter matched, show a mix
  if (filtered.length === 0) filtered = catalog;

  // Pick top results (3-5)
  const picks = filtered.slice(0, isRoute ? 5 : 3);

  if (picks.length === 0) {
    return lang === 'gl'
      ? 'Sentimolo, non atopei recursos que coincidan coa tua busca no catalogo actual. Proba con outra pregunta!'
      : 'Lo siento, no encontre recursos que coincidan con tu busqueda en el catalogo actual. Prueba con otra pregunta!';
  }

  // Build reply with IDs
  const greeting = lang === 'gl' ? 'Aqui tes as minas recomendacions' : 'Aqui tienes mis recomendaciones';
  const forText = muniFilter ? (lang === 'gl' ? ` para ${muniFilter}` : ` para ${muniFilter}`) : '';

  let reply = `${greeting}${forText}:\n\n`;

  picks.forEach((r, i) => {
    reply += `${i + 1}. **${r.nombre}** (${r.municipio})`;
    if (r.estrellas) reply += ` — ${r.estrellas} estrellas`;
    reply += ` [ID:${r.id}]\n`;
    if (r.descripcion) reply += `   ${r.descripcion.slice(0, 120)}...\n`;
    if (r.horario) reply += `   Horario: ${r.horario}\n`;
    reply += '\n';
  });

  if (isRoute) {
    reply += lang === 'gl'
      ? 'Esta ruta segue a costa de norte a sur. Podes facela nun dia tranquilamente!'
      : 'Esta ruta sigue la costa de norte a sur. Puedes hacerla en un dia tranquilamente!';
  }

  reply += '\n' + (lang === 'gl' ? 'Queres saber mais sobre algún destes?' : 'Quieres saber mas sobre alguno de estos?');

  return reply;
}

// ---------------------------------------------------------------------------
// Call LLM (Anthropic Claude) — swap this function for another provider
// ---------------------------------------------------------------------------
async function callLLM(
  apiKey: string,
  message: string,
  catalog: CatalogItem[],
  history: { role: string; content: string }[],
  lang: string,
): Promise<{ reply: string; tokensUsed: number }> {
  const langLabel = lang === 'gl' ? 'gallego' : lang === 'en' ? 'ingles' : lang === 'fr' ? 'frances' : lang === 'pt' ? 'portugues' : 'espanol';

  // Compact catalog (strip descriptions to save tokens)
  const compactCatalog = catalog.map(({ id, slug, nombre, tipo, municipio, lat, lng, estrellas, horario }) => ({
    id, slug, nombre, tipo, municipio, lat, lng, ...(estrellas && { estrellas }), ...(horario && { horario }),
  }));

  const systemPrompt = `Eres el asistente turistico de O Salnes, una comarca de 8 municipios en las Rias Baixas de Galicia (Espana). Tu mision es ayudar a turistas a descubrir la zona.

REGLAS:
- Responde SIEMPRE en ${langLabel}.
- Basa tus respuestas UNICAMENTE en los recursos del catalogo que te proporciono.
- Cuando menciones un recurso, incluye su ID entre corchetes: [ID:uuid].
- Si el usuario pide una ruta, sugiere entre 3 y 5 recursos ordenados geograficamente (de norte a sur o siguiendo la costa).
- Se amable, conciso y entusiasta. Usa emojis con moderacion.
- Si no encuentras recursos relevantes en el catalogo, dilo honestamente.
- NUNCA inventes recursos que no esten en el catalogo.

CATALOGO DE RECURSOS TURISTICOS (${compactCatalog.length} recursos):
${JSON.stringify(compactCatalog)}`;

  const messages = [
    ...history.slice(-10).map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const res = await fetch(ANTHROPIC_API_URL, {
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

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[assistant] Anthropic API error:', res.status, errBody);
    throw new Error('LLM API error');
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await res.json();
  return {
    reply: data.content?.[0]?.text || '',
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}

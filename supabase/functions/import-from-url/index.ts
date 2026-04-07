/**
 * Import From URL — Supabase Edge Function
 *
 * Extrae datos turisticos estructurados desde una URL externa usando IA.
 * Hace fetch del HTML, lo limpia, y le pide a Gemini que extraiga campos
 * relevantes para crear un recurso turistico.
 */
import { handleCors, json } from '../_shared/cors.ts';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Eres un extractor experto de informacion turistica. Tu tarea es analizar el HTML de una pagina web y extraer datos estructurados sobre el recurso turistico que describe (hotel, restaurante, playa, museo, etc.).

Reglas:
- Extrae SOLO los datos que aparecen claramente en el HTML
- Si un dato no esta presente, devuelvelo como string vacio o array vacio
- Para la descripcion: redacta una descripcion turistica atractiva de 100-200 palabras basandote en lo que veas
- Para el rdf_type, usa uno de: Hotel, Restaurant, Beach, Museum, Landform, Festival, Winery, Trail, RuralHouse, TouristAttraction
- Detecta telefonos en formato +34... o sin prefijo
- Detecta emails (correo@dominio)
- Detecta coordenadas si aparecen (lat, lng como decimales)
- Para tipos de turismo: deduce los mas relevantes segun el contenido

Responde EXCLUSIVAMENTE con un objeto JSON valido con esta estructura exacta:
{
  "name": "nombre del recurso",
  "rdf_type": "Hotel",
  "description": "descripcion turistica de 100-200 palabras",
  "address": "direccion postal completa",
  "postal_code": "codigo postal",
  "telephone": ["+34..."],
  "email": ["..."],
  "url": "url oficial",
  "opening_hours": "Mo-Su 09:00-18:00",
  "latitude": 42.4345,
  "longitude": -8.8712,
  "tourist_types": ["TYPE TOURISM", ...],
  "rating_value": 4,
  "cuisine": ["gallega", "mariscos"],
  "extracted_from": "url original"
}

Sin texto adicional, sin markdown, SOLO el JSON.`;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY not configured' }, 500, req);
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return json({ error: 'URL invalida. Debe empezar por http:// o https://' }, 400, req);
    }

    // 1. Fetch HTML from the URL
    let html: string;
    try {
      const fetchRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OSalnesBot/1.0; +https://osalnes.gal)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es,gl,en',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      if (!fetchRes.ok) {
        return json({ error: `No se pudo acceder a la URL (${fetchRes.status})` }, 400, req);
      }

      html = await fetchRes.text();
    } catch (err) {
      console.error('[import-from-url] Fetch error:', err);
      return json({ error: 'No se pudo descargar la pagina. Verifica la URL.' }, 400, req);
    }

    // 2. Clean HTML — strip scripts, styles, comments and reduce whitespace
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit input to avoid blowing the token budget (Gemini Flash handles large inputs but be safe)
    const MAX_CHARS = 30000;
    const truncated = cleaned.length > MAX_CHARS ? cleaned.slice(0, MAX_CHARS) + '... [truncated]' : cleaned;

    const userPrompt = `Extrae los datos turisticos del siguiente HTML.\n\nURL original: ${url}\n\nHTML:\n${truncated}`;

    const start = Date.now();

    // 3. Call Gemini
    const aiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          topP: 0.9,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[import-from-url] Gemini error:', aiRes.status, errText);
      return json({ error: 'Error del servicio de IA' }, 500, req);
    }

    const data = await aiRes.json();
    const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    // 4. Parse JSON
    let result: unknown;
    try {
      const jsonMatch = rawResult.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawResult];
      result = JSON.parse(jsonMatch[1]!.trim());
    } catch (err) {
      console.error('[import-from-url] JSON parse error:', err, 'raw:', rawResult);
      return json({ error: 'La IA no devolvio un formato valido' }, 500, req);
    }

    return json({
      result,
      tokens_used: tokensUsed,
      duration_ms: Date.now() - start,
      model: 'gemini-2.5-flash',
      source_url: url,
    }, 200, req);

  } catch (err) {
    console.error('[import-from-url] Error:', err);
    return json({ error: 'Error interno del importador' }, 500, req);
  }
});

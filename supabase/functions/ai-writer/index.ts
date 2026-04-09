/**
 * AI Writer — Supabase Edge Function
 * Multi-purpose AI assistant for CMS content creation.
 *
 * Actions:
 *   improve    — Improve/rewrite a tourism description
 *   translate  — Context-aware tourism translation
 *   seo        — Generate SEO title + description from content
 *   validate   — Evaluate content quality and completeness
 *   categorize — Suggest categories/tourist types from content
 *   alt_text   — Generate alt text for an image description
 */
import { handleCors, json } from '../_shared/cors.ts';
import { verifyAuth, requireRole } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/rate-limit.ts';
import { formatError } from '../_shared/errors.ts';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CONTEXT_SALNES = `O Salnés es una comarca de 8 municipios en las Rías Baixas de Galicia (España): Cambados, Sanxenxo, O Grove, Vilagarcía de Arousa, Vilanova de Arousa, A Illa de Arousa, Meaño, Meis y Ribadumia. Famosa por el vino Albariño (DO Rías Baixas), mariscos excepcionales, playas de arena fina, patrimonio cultural (pazos, iglesias románicas), la Festa do Albariño, Pazo de Fefiñáns, la Isla de A Toxa, y una gastronomía de primer nivel (marisco fresco, pulpo, empanada gallega).`;

const ACTION_PROMPTS: Record<string, string> = {
  improve: `Eres un redactor experto en turismo para O Salnés (Galicia). Tu tarea es mejorar textos turísticos.

${CONTEXT_SALNES}

Reglas:
- Mejora el texto haciéndolo más atractivo, evocador y profesional
- Mantén la información factual original, no inventes datos
- Usa un tono acogedor que invite a visitar
- Incluye detalles sensoriales (aromas, paisajes, sabores) cuando sea natural
- Extensión ideal: 100-250 palabras
- Responde SOLO con el texto mejorado, sin explicaciones
- Responde en el MISMO idioma que el texto original`,

  translate: `Eres un traductor profesional especializado en turismo gallego.

${CONTEXT_SALNES}

Reglas:
- Traduce manteniendo el tono turístico, evocador y profesional
- Para gallego: usa gallego real y natural (NON castellano con cambios menores). Usa terminoloxía propia: praia, miradoiro, igrexa, concello, festas, gastronomía, viños, mariscos
- Para inglés: usa vocabulario turístico internacional (stunning, charming, nestled, boasting)
- Para francés: mantén el estilo turístico elegante francés
- Para portugués: adapta al portugués europeo
- NUNCA traduzcas nombres propios de lugares (Cambados, Sanxenxo, A Lanzada...)
- Responde SOLO con la traducción, sin explicaciones ni comillas`,

  seo: `Eres un experto SEO especializado en turismo en Galicia.

${CONTEXT_SALNES}

Tu tarea: generar título SEO y meta descripción a partir del contenido proporcionado.

Reglas:
- Título SEO: máximo 60 caracteres, incluir keyword principal y ubicación
- Meta descripción: entre 120-160 caracteres, call-to-action implícito, incluir keywords secundarias
- Prioriza keywords de turismo en Galicia: Rías Baixas, O Salnés, Albariño, playas Galicia, turismo rural Galicia
- Responde en formato JSON exacto:
{"title_es":"...","desc_es":"...","title_gl":"...","desc_gl":"..."}
- Sin explicaciones adicionales, SOLO el JSON`,

  validate: `Eres un auditor de calidad de contenido turístico para el portal DTI de O Salnés.

${CONTEXT_SALNES}

Tu tarea: evaluar la calidad y completitud del contenido de un recurso turístico.

Analiza y responde en formato JSON exacto:
{
  "score": 0-100,
  "level": "excelente|bueno|mejorable|incompleto",
  "issues": ["problema 1", "problema 2"],
  "suggestions": ["sugerencia 1", "sugerencia 2"],
  "missing_fields": ["campo que falta 1"],
  "seo_ready": true/false,
  "translation_quality": "buena|aceptable|mejorable|ausente"
}

Criterios de puntuación:
- Nombre en ES y GL: +10 puntos cada uno
- Descripción ES >50 palabras: +15 puntos
- Descripción GL >50 palabras: +10 puntos
- Coordenadas GPS: +10 puntos
- Teléfono o email: +5 puntos
- Web: +5 puntos
- Categorías asignadas: +5 puntos
- Imágenes (si se indica): +10 puntos
- SEO title y description: +10 puntos
- Traducciones EN/FR/PT: +5 puntos por idioma

Sin explicaciones adicionales, SOLO el JSON`,

  categorize: `Eres un clasificador experto en turismo según la norma UNE 178503.

${CONTEXT_SALNES}

A partir del nombre y descripción de un recurso turístico, sugiere:
1. Los tipos de turismo más relevantes (del estándar UNE 178503)
2. Posibles categorías internas del portal

Tipos de turismo disponibles:
- Viajero: FAMILY, LGTBI, BACKPACKING, BUSINESS, ROMANTIC, SENIOR
- Actividad: ADVENTURE, WELLNESS, CYCLING, DIVING, SAILING, WATER SPORTS, TREKKING
- Motivación: BEACH AND SUN, CULTURAL, ECOTOURISM, HERITAGE, NATURE, RURAL, BIRDWATCHING, EVENTS AND FESTIVALS
- Producto: FOOD, WINE, BEER, OLIVE OIL

Responde en JSON exacto:
{"tourist_types":["TYPE1 TOURISM","TYPE2 TOURISM"],"reasoning":"explicación breve"}
Sin texto adicional, SOLO el JSON`,

  alt_text: `Genera un texto alternativo (alt text) descriptivo y accesible para una imagen turística.

Reglas:
- Máximo 125 caracteres
- Descriptivo y útil para lectores de pantalla
- Incluye contexto turístico si es relevante
- Responde SOLO con el texto alt, sin comillas ni explicaciones
- Responde en el idioma indicado`,
};

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // Audit C4 — gate the AI proxy behind auth + role + rate limit.
    // Without this, anyone with the public anon key (which is in every
    // CMS bundle) could use this endpoint as a free Gemini proxy and
    // burn the project's API budget.
    rateLimit(req);
    const user = await verifyAuth(req);
    requireRole(user, 'admin', 'editor', 'tecnico');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return json({ error: 'GEMINI_API_KEY not configured', mock: true, result: getMockResult(req) }, 200, req);
    }

    const body = await req.json();
    const { action, text, from, to, context, lang } = body;

    if (!action || !ACTION_PROMPTS[action]) {
      return json({ error: `Invalid action. Valid: ${Object.keys(ACTION_PROMPTS).join(', ')}` }, 400, req);
    }

    const systemPrompt = ACTION_PROMPTS[action];

    // Build user message based on action
    let userMessage = '';

    switch (action) {
      case 'improve':
        userMessage = `Mejora este texto turístico:\n\n${text}`;
        break;

      case 'translate':
        userMessage = `Traduce el siguiente texto de ${langName(from || 'es')} a ${langName(to || 'gl')}:\n\n${text}`;
        break;

      case 'seo': {
        const name = context?.name || '';
        const desc = text || context?.description || '';
        const type = context?.type || '';
        const municipality = context?.municipality || '';
        userMessage = `Genera SEO para este recurso turístico:
Nombre: ${name}
Tipo: ${type}
Municipio: ${municipality}
Descripción: ${desc}`;
        break;
      }

      case 'validate': {
        userMessage = `Evalúa la calidad de este recurso turístico:\n${JSON.stringify(context, null, 2)}`;
        break;
      }

      case 'categorize': {
        const name = context?.name || '';
        const desc = text || context?.description || '';
        const type = context?.type || '';
        userMessage = `Clasifica este recurso turístico:
Nombre: ${name}
Tipo: ${type}
Descripción: ${desc}`;
        break;
      }

      case 'alt_text':
        userMessage = `Genera alt text en ${langName(lang || 'es')} para una imagen de: ${text}`;
        break;

      default:
        userMessage = text;
    }

    const start = Date.now();

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: action === 'translate' ? 0.2 : action === 'improve' ? 0.7 : 0.4,
          maxOutputTokens: action === 'validate' ? 1024 : 512,
          topP: 0.9,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[ai-writer] Gemini error:', res.status, errText);
      return json({ error: 'Error del servicio de IA', details: errText }, 500, req);
    }

    const data = await res.json();
    const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    // Parse JSON responses for structured actions
    let result: unknown = rawResult;
    if (['seo', 'validate', 'categorize'].includes(action)) {
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = rawResult.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawResult];
        result = JSON.parse(jsonMatch[1]!.trim());
      } catch {
        result = rawResult;
      }
    }

    return json({
      action,
      result,
      tokens_used: tokensUsed,
      duration_ms: Date.now() - start,
      model: 'gemini-2.5-flash',
    }, 200, req);

  } catch (err) {
    console.error('[ai-writer] Error:', err);
    const [body, status] = formatError(err);
    return json(body, status, req);
  }
});

function langName(code: string): string {
  const names: Record<string, string> = {
    es: 'español', gl: 'gallego', en: 'inglés', fr: 'francés', pt: 'portugués',
  };
  return names[code] || code;
}

async function getMockResult(req: Request): Promise<unknown> {
  try {
    const { action } = await req.clone().json();
    if (action === 'validate') {
      return { score: 65, level: 'mejorable', issues: ['Modo demo — conecta GEMINI_API_KEY para evaluación real'], suggestions: [], missing_fields: [], seo_ready: false, translation_quality: 'ausente' };
    }
    if (action === 'seo') {
      return { title_es: 'Título SEO de ejemplo', desc_es: 'Descripción SEO de ejemplo para modo demo', title_gl: 'Título SEO de exemplo', desc_gl: 'Descrición SEO de exemplo para modo demo' };
    }
    return 'Modo demo: configura GEMINI_API_KEY para activar la IA';
  } catch {
    return 'Mock mode';
  }
}

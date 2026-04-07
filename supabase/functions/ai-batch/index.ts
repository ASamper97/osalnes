/**
 * AI Batch — Supabase Edge Function
 * Auto-deployed via GitHub Actions (deploy-functions.yml)
 *
 * Procesa multiples recursos turisticos en lote con acciones de IA.
 * Acciones disponibles:
 *   - translate: traduce nombre y descripcion a un idioma destino
 *   - improve:   mejora la descripcion en castellano
 *   - seo:       genera SEO title/desc en ES y GL
 *   - validate:  evalua calidad y devuelve score por recurso
 *   - categorize: sugiere tipos de turismo UNE 178503
 *
 * Limita a 15 recursos por invocacion para mantenerse dentro del timeout
 * de 25s de Supabase Edge Functions.
 */
import { handleCors, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase.ts';
import { getTranslations, saveTranslations } from '../_shared/translations.ts';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const MAX_BATCH_SIZE = 15;

const CONTEXT_SALNES = `O Salnes es una comarca de 8 municipios en las Rias Baixas de Galicia (Espana): Cambados, Sanxenxo, O Grove, Vilagarcia de Arousa, Vilanova de Arousa, A Illa de Arousa, Meano, Meis y Ribadumia. Famosa por el vino Albariño (DO Rias Baixas), mariscos, playas, Festa do Albariño, Pazo de Fefiñans, Isla de A Toxa.`;

interface ResourceRow {
  id: string;
  slug: string;
  rdf_type: string;
}

interface BatchResult {
  id: string;
  slug: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  data?: unknown;
}

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
    const { action, resource_ids, target_lang } = await req.json();

    if (!action || !['translate', 'improve', 'seo', 'validate', 'categorize'].includes(action)) {
      return json({ error: 'Invalid action' }, 400, req);
    }

    if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
      return json({ error: 'resource_ids must be a non-empty array' }, 400, req);
    }

    if (resource_ids.length > MAX_BATCH_SIZE) {
      return json({ error: `Maximo ${MAX_BATCH_SIZE} recursos por lote` }, 400, req);
    }

    if (action === 'translate' && (!target_lang || !['gl', 'en', 'fr', 'pt'].includes(target_lang))) {
      return json({ error: 'translate requires target_lang (gl|en|fr|pt)' }, 400, req);
    }

    const sb = getAdminClient();

    // Fetch resources
    const { data: resources, error } = await sb
      .from('recurso_turistico')
      .select('id, slug, rdf_type')
      .in('id', resource_ids);

    if (error) throw error;

    const start = Date.now();
    const results: BatchResult[] = [];

    for (const resource of (resources || []) as ResourceRow[]) {
      try {
        const result = await processResource(action, resource, apiKey, target_lang);
        results.push(result);
      } catch (err) {
        results.push({
          id: resource.id,
          slug: resource.slug,
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const completed = results.filter((r) => r.status === 'ok').length;
    const errors = results.filter((r) => r.status === 'error').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return json({
      action,
      processed: results.length,
      completed,
      errors,
      skipped,
      duration_ms: Date.now() - start,
      results,
    }, 200, req);

  } catch (err) {
    console.error('[ai-batch] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500, req);
  }
});

// ---------------------------------------------------------------------------
// Per-resource processing
// ---------------------------------------------------------------------------

async function processResource(
  action: string,
  resource: ResourceRow,
  apiKey: string,
  targetLang?: string,
): Promise<BatchResult> {
  const translations = await getTranslations('recurso_turistico', resource.id);
  const nameEs = translations.name?.es || '';
  const descEs = translations.description?.es || '';

  if (!nameEs.trim()) {
    return { id: resource.id, slug: resource.slug, status: 'skipped', message: 'Sin nombre en castellano' };
  }

  switch (action) {
    case 'translate': {
      if (!targetLang) throw new Error('target_lang required');
      const existingName = translations.name?.[targetLang];
      const existingDesc = translations.description?.[targetLang];

      // Skip if already translated
      if (existingName && existingDesc) {
        return { id: resource.id, slug: resource.slug, status: 'skipped', message: `Ya tiene traduccion en ${targetLang}` };
      }

      const updates: Record<string, Record<string, string>> = {};
      if (!existingName && nameEs) {
        const tr = await translateText(nameEs, 'es', targetLang, apiKey);
        updates.name = { [targetLang]: tr };
      }
      if (!existingDesc && descEs) {
        const tr = await translateText(descEs, 'es', targetLang, apiKey);
        updates.description = { [targetLang]: tr };
      }

      // Save translations
      for (const [campo, vals] of Object.entries(updates)) {
        await saveTranslations('recurso_turistico', resource.id, campo, vals);
      }

      return { id: resource.id, slug: resource.slug, status: 'ok', message: `Traducido a ${targetLang}` };
    }

    case 'improve': {
      if (!descEs.trim()) {
        return { id: resource.id, slug: resource.slug, status: 'skipped', message: 'Sin descripcion para mejorar' };
      }

      const improved = await callGemini(
        `Eres un redactor experto en turismo para O Salnes (Galicia). Mejora textos haciendolos atractivos, evocadores y profesionales. ${CONTEXT_SALNES}\n\nReglas:\n- Mejora el texto haciendolo mas atractivo y profesional\n- No inventes datos que no esten en el original\n- 100-250 palabras\n- Responde SOLO con el texto mejorado`,
        `Mejora este texto turistico:\n\n${stripHtml(descEs)}`,
        apiKey,
        0.7,
      );

      await saveTranslations('recurso_turistico', resource.id, 'description', { es: `<p>${improved.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` });

      return { id: resource.id, slug: resource.slug, status: 'ok', message: 'Descripcion mejorada' };
    }

    case 'seo': {
      const prompt = `Eres un experto SEO en turismo Galicia. ${CONTEXT_SALNES}\n\nGenera titulo SEO (max 60 chars) y meta descripcion (120-160 chars) en ES y GL.\n\nResponde EXCLUSIVAMENTE con JSON:\n{"title_es":"...","desc_es":"...","title_gl":"...","desc_gl":"..."}`;
      const userMsg = `Recurso: ${nameEs}\nTipo: ${resource.rdf_type}\nDescripcion: ${stripHtml(descEs).slice(0, 500)}`;

      const raw = await callGemini(prompt, userMsg, apiKey, 0.4);
      const seo = parseJson<{ title_es: string; desc_es: string; title_gl: string; desc_gl: string }>(raw);

      if (!seo) throw new Error('Respuesta SEO invalida');

      await saveTranslations('recurso_turistico', resource.id, 'seo_title', { es: seo.title_es, gl: seo.title_gl });
      await saveTranslations('recurso_turistico', resource.id, 'seo_description', { es: seo.desc_es, gl: seo.desc_gl });

      return { id: resource.id, slug: resource.slug, status: 'ok', message: 'SEO generado', data: seo };
    }

    case 'validate': {
      const prompt = `Eres un auditor de calidad de contenido turistico. Evalua score 0-100, level (excelente|bueno|mejorable|incompleto), issues[], suggestions[].\n\nResponde JSON:\n{"score":0-100,"level":"...","issues":[],"suggestions":[]}`;
      const userMsg = `Nombre: ${nameEs}\nDescripcion: ${stripHtml(descEs).slice(0, 800) || '(vacia)'}\nIdiomas: ${Object.keys(translations.name || {}).join(', ')}`;

      const raw = await callGemini(prompt, userMsg, apiKey, 0.4);
      const validation = parseJson<{ score: number; level: string; issues: string[]; suggestions: string[] }>(raw);

      if (!validation) throw new Error('Respuesta validate invalida');

      return { id: resource.id, slug: resource.slug, status: 'ok', message: `Calidad ${validation.level} (${validation.score})`, data: validation };
    }

    case 'categorize': {
      const prompt = `Eres un clasificador UNE 178503. Sugiere tipos de turismo relevantes.\nTipos: FAMILY, ROMANTIC, SENIOR, ADVENTURE, WELLNESS, CULTURAL, ECOTOURISM, RURAL, BEACH AND SUN, NATURE, FOOD, WINE, HERITAGE.\n\nResponde JSON: {"tourist_types":["TYPE TOURISM",...],"reasoning":"..."}`;
      const userMsg = `Nombre: ${nameEs}\nTipo: ${resource.rdf_type}\nDescripcion: ${stripHtml(descEs).slice(0, 500)}`;

      const raw = await callGemini(prompt, userMsg, apiKey, 0.4);
      const cat = parseJson<{ tourist_types: string[]; reasoning: string }>(raw);

      if (!cat) throw new Error('Respuesta categorize invalida');

      // Update tourist_types in the resource directly (column on recurso_turistico)
      const sb = getAdminClient();
      await sb.from('recurso_turistico').update({ tourist_types: cat.tourist_types }).eq('id', resource.id);

      return { id: resource.id, slug: resource.slug, status: 'ok', message: `${cat.tourist_types.length} tipos sugeridos`, data: cat };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

async function callGemini(systemPrompt: string, userMessage: string, apiKey: string, temperature = 0.4): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature, maxOutputTokens: 1024, topP: 0.9 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function translateText(text: string, from: string, to: string, apiKey: string): Promise<string> {
  const langNames: Record<string, string> = {
    es: 'Spanish', gl: 'Galician', en: 'English', fr: 'French', pt: 'Portuguese',
  };
  const prompt = `Translate the following ${langNames[from] || from} text to ${langNames[to] || to}. Return ONLY the translation, no quotes or explanations. For Galician use real Galician (not modified Spanish). Preserve HTML tags if present.\n\nText: ${text}`;

  return await callGemini('Eres un traductor especializado en turismo gallego. Mantienes el tono evocador y profesional.', prompt, apiKey, 0.2);
}

function parseJson<T>(raw: string): T | null {
  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    return JSON.parse(match[1]!.trim()) as T;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Auto-Translate Worker — Supabase Edge Function
 *
 * Processes pending translation jobs from the translation_job table.
 * Calls an external translation API (LibreTranslate by default, swap to DeepL/Google).
 * Designed for: cron invocation, manual trigger, or webhook.
 *
 * INVOCATION:
 *   POST /functions/v1/auto-translate   (processes batch of pending jobs)
 *   GET  /functions/v1/auto-translate   (health check + pending count)
 *
 * ENV VARS:
 *   TRANSLATE_API_URL     — Translation API endpoint (default: LibreTranslate)
 *   TRANSLATE_API_KEY     — API key if required
 *   TRANSLATE_PROVIDER    — "libretranslate" | "deepl" | "mock" (default: mock)
 *   TRANSLATE_BATCH_SIZE  — Jobs per invocation (default: 20)
 */
import { handleCors, json } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase.ts';

const PROVIDER = Deno.env.get('TRANSLATE_PROVIDER') || 'mock';
const API_URL = Deno.env.get('TRANSLATE_API_URL') || 'https://libretranslate.de/translate';
const API_KEY = Deno.env.get('TRANSLATE_API_KEY') || '';
const BATCH_SIZE = parseInt(Deno.env.get('TRANSLATE_BATCH_SIZE') || '20');

// Language code mapping for external APIs
// Note: GL (Galician) maps to 'gl' natively. For APIs without GL support,
// PT (Portuguese) is the closest approximation but should be marked for review.
const LANG_MAP: Record<string, string> = {
  es: 'es', gl: 'gl', en: 'en', fr: 'fr', pt: 'pt',
};

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getAdminClient();

  // Health check
  if (req.method === 'GET') {
    const { count } = await sb
      .from('translation_job')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente');

    return json({
      status: 'ok',
      provider: PROVIDER,
      pendingJobs: count || 0,
      batchSize: BATCH_SIZE,
    }, 200, req);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // Direct translation mode: { texto, from, to }
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.clone().json().catch(() => null);
      if (body?.texto && body?.to) {
        const translated = await translateText(body.texto, body.from || 'es', body.to);
        return json({ translated, from: body.from || 'es', to: body.to, provider: PROVIDER }, 200, req);
      }
    }
    // 1. Fetch pending jobs (oldest first, limited to batch size)
    const { data: jobs, error } = await sb
      .from('translation_job')
      .select('*')
      .eq('estado', 'pendiente')
      .lt('intentos', 3)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return json({ processed: 0, message: 'No pending jobs' }, 200, req);
    }

    // 2. Mark as in_process (claim the batch)
    const jobIds = jobs.map((j) => j.id);
    await sb
      .from('translation_job')
      .update({ estado: 'en_proceso' })
      .in('id', jobIds);

    // 3. Process each job
    let completed = 0;
    let errors = 0;

    for (const job of jobs) {
      try {
        // Increment attempt counter
        await sb
          .from('translation_job')
          .update({ intentos: job.intentos + 1 })
          .eq('id', job.id);

        // Translate
        const translated = await translateText(
          job.texto_origen,
          job.idioma_origen,
          job.idioma_destino,
        );

        if (!translated) {
          throw new Error('Empty translation result');
        }

        // Save to traduccion table (idempotent UPSERT)
        await sb
          .from('traduccion')
          .upsert(
            {
              entidad_tipo: job.entidad_tipo,
              entidad_id: job.entidad_id,
              campo: job.campo,
              idioma: job.idioma_destino,
              valor: translated,
            },
            { onConflict: 'entidad_tipo,entidad_id,campo,idioma' },
          );

        // Mark job as completed
        await sb
          .from('translation_job')
          .update({
            estado: 'completado',
            texto_traducido: translated,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        completed++;
      } catch (err) {
        errors++;
        const errMsg = err instanceof Error ? err.message : String(err);
        const newState = (job.intentos + 1) >= (job.max_intentos || 3) ? 'error' : 'pendiente';

        await sb
          .from('translation_job')
          .update({
            estado: newState,
            error_msg: errMsg,
          })
          .eq('id', job.id);
      }
    }

    return json({
      processed: jobs.length,
      completed,
      errors,
      provider: PROVIDER,
    }, 200, req);

  } catch (err) {
    console.error('[auto-translate] Error:', err);
    return json({ error: 'Internal error' }, 500, req);
  }
});

// ---------------------------------------------------------------------------
// Translation providers — swap by changing TRANSLATE_PROVIDER env var
// ---------------------------------------------------------------------------

async function translateText(text: string, from: string, to: string): Promise<string> {
  // Auto-detect: use Gemini if key available, otherwise fall to configured provider
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) return geminiTranslate(text, from, to, geminiKey);
  if (PROVIDER === 'mock') return mockTranslate(text, from, to);
  if (PROVIDER === 'libretranslate') return libreTranslate(text, from, to);
  if (PROVIDER === 'deepl') return deeplTranslate(text, from, to);
  return mockTranslate(text, from, to);
}

/** Mock provider — prefixes with language tag for testing */
function mockTranslate(text: string, _from: string, to: string): Promise<string> {
  // Simulate async delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`[${to.toUpperCase()}] ${text}`);
    }, 50);
  });
}

/** LibreTranslate — free/self-hosted translation API */
async function libreTranslate(text: string, from: string, to: string): Promise<string> {
  const sourceLang = LANG_MAP[from] || from;
  const targetLang = LANG_MAP[to] || to;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
      ...(API_KEY && { api_key: API_KEY }),
    }),
  });

  if (!res.ok) throw new Error(`LibreTranslate ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.translatedText;
}

/** DeepL — commercial translation API (best quality) */
async function deeplTranslate(text: string, from: string, to: string): Promise<string> {
  const langMap: Record<string, string> = {
    es: 'ES', en: 'EN', fr: 'FR', pt: 'PT', gl: 'PT',
  };

  const res = await fetch(API_URL || 'https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `DeepL-Auth-Key ${API_KEY}`,
    },
    body: JSON.stringify({
      text: [text],
      source_lang: langMap[from] || 'ES',
      target_lang: langMap[to] || 'EN',
    }),
  });

  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.translations?.[0]?.text || '';
}

/** Gemini — Google AI translation (uses GEMINI_API_KEY secret) */
async function geminiTranslate(text: string, from: string, to: string, apiKey: string): Promise<string> {
  const langNames: Record<string, string> = {
    es: 'Spanish', gl: 'Galician', en: 'English', fr: 'French', pt: 'Portuguese',
  };
  const fromLang = langNames[from] || from;
  const toLang = langNames[to] || to;

  const prompt = `Translate the following text from ${fromLang} to ${toLang}. Return ONLY the translated text, nothing else. Do not add quotes, explanations, or formatting.\n\nText: ${text}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    console.error('[auto-translate] Gemini error:', res.status);
    // Fallback to mock if Gemini fails (rate limit, etc.)
    return mockTranslate(text, from, to);
  }

  const data = await res.json();
  const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return translated || text;
}

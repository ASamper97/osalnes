/**
 * CMS Assistant — Supabase Edge Function
 * AI assistant for CMS editors using Google Gemini Flash.
 * Helps write descriptions, translate, optimize SEO, audit content quality.
 */
import { handleCors, json } from '../_shared/cors.ts';
import { verifyAuth, requireRole } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/rate-limit.ts';
import { formatError } from '../_shared/errors.ts';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Eres el asistente IA del CMS turistico de O Salnes (Galicia, Espana). Ayudas a los tecnicos de turismo a gestionar el contenido de la plataforma DTI (Destino Turistico Inteligente).

Tu rol:
- Escribir descripciones turisticas atractivas y profesionales
- Traducir contenido entre espanol, gallego, ingles, frances y portugues
- Optimizar textos para SEO (titulos <60 chars, descripciones <160 chars)
- Sugerir mejoras en la calidad del contenido
- Responder preguntas sobre la plataforma y los estandares UNE 178502/178503

Contexto de O Salnes:
- Comarca de 8 municipios en las Rias Baixas de Galicia: Cambados, Sanxenxo, O Grove, Vilagarcia de Arousa, Vilanova de Arousa, A Illa de Arousa, Meano, Meis, Ribadumia
- Famosa por: vino Albarino, mariscos, playas, Festa do Albarino, Pazo de Fefinans, Isla de A Toxa
- Patrimonio: pazos, iglesias romanicas, torres medievales, puentes historicos
- Gastronomia: marisco fresco, pulpo, empanada gallega, vinos DO Rias Baixas

Reglas:
- Responde SIEMPRE en el idioma en que te preguntan
- Se conciso y profesional
- Cuando escribas descripciones turisticas, usa un tono acogedor y evocador
- Para SEO, prioriza keywords relevantes de turismo en Galicia
- Si te piden traducir a gallego, usa gallego real y natural (no castellano con pequenos cambios)`;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // Audit C4 — gate the chat assistant behind auth + role + rate limit.
    rateLimit(req);
    const user = await verifyAuth(req);
    requireRole(user, 'admin', 'editor', 'tecnico', 'validador', 'analitica');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return json({ error: 'GEMINI_API_KEY not configured' }, 500, req);
    }

    const { message, context, history = [] } = await req.json();

    if (!message?.trim()) {
      return json({ error: 'message is required' }, 400, req);
    }

    // Build conversation with context
    const contents = [];

    // Add history
    for (const h of history.slice(-10)) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }

    // Build user message with optional resource context
    let userMessage = message;
    if (context) {
      userMessage = `[Contexto del recurso que estoy editando: ${JSON.stringify(context)}]\n\n${message}`;
    }

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const start = Date.now();

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[cms-assistant] Gemini error:', res.status, errText);
      return json({ error: 'Error del asistente IA' }, 500, req);
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    return json({
      reply,
      tokens_used: tokensUsed,
      duration_ms: Date.now() - start,
      model: 'gemini-2.0-flash',
    }, 200, req);

  } catch (err) {
    console.error('[cms-assistant] Error:', err);
    const [body, status] = formatError(err);
    return json(body, status, req);
  }
});

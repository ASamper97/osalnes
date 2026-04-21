// ──────────────────────────────────────────────────────────────────────────
// PATCH · supabase/functions/ai-writer/index.ts
//
// Añade 3 acciones al Edge Function para el paso 6:
//   - generateSeo       — título + descripción SEO
//   - suggestKeywords   — 5-8 keywords
//   - translateResource — traducción nombre + descripción a EN/FR/PT
// ──────────────────────────────────────────────────────────────────────────


// ═══════════ 1) AÑADIR AL TIPO Action ═══════════
/*
type Action =
  | 'draft'
  | 'improve'
  | 'translate'
  | 'seo'
  | 'validate'
  | 'categorize'
  | 'alt_text'
  | 'suggestTags'
  | 'genAltText'
  | 'generateSeo'        // ← NUEVO
  | 'suggestKeywords'    // ← NUEVO
  | 'translateResource'; // ← NUEVO
*/

// ═══════════ 2) PROMPTS ═══════════

function buildGenerateSeoPrompt(input: {
  descriptionEs: string;
  resourceName: string;
  lang: 'es' | 'gl';
  typeLabel?: string | null;
  municipio?: string | null;
}): string {
  const langLabel = input.lang === 'es' ? 'castellano' : 'gallego';
  const typeHint = input.typeLabel ? `Tipo: ${input.typeLabel}.` : '';
  const muniHint = input.municipio ? `Ubicación: ${input.municipio}.` : '';

  return `Eres experto SEO para turismo local en Galicia. Genera un título y una descripción optimizados para Google.

Recurso:
  - Nombre: ${input.resourceName}
  - ${typeHint}
  - ${muniHint}
  - Descripción original: """
${input.descriptionEs.trim()}
"""

Reglas para el TÍTULO SEO (${langLabel}):
  1. Entre 30 y 60 caracteres. Nunca más de 60.
  2. Incluir nombre + ubicación o tipo ("Pazo de Fefiñáns | Cambados").
  3. Directo, sin mayúsculas innecesarias ni exclamaciones.

Reglas para la DESCRIPCIÓN SEO (${langLabel}):
  1. Entre 120 y 160 caracteres. Nunca más de 160.
  2. Resume la esencia del recurso en 1-2 frases naturales.
  3. Terminar con una llamada suave a la acción ("Visítalo...", "Descubre...") si cabe.
  4. NO repetir el título literalmente.

Responde EXCLUSIVAMENTE con JSON válido (sin markdown, sin comillas extras):
{"title":"...","description":"..."}`;
}

function buildSuggestKeywordsPrompt(descriptionEs: string): string {
  return `Lee la siguiente descripción de un recurso turístico de O Salnés (Galicia) y extrae 5-8 palabras clave relevantes.

Descripción:
"""
${descriptionEs.trim()}
"""

Reglas:
  1. Entre 5 y 8 keywords.
  2. Minúsculas, sin tildes, una o dos palabras cada una.
  3. SOLO términos que aparezcan o se puedan inferir claramente del texto.
  4. Incluye tipo de recurso, ubicación y características singulares.
  5. NO inventes términos genéricos ("turismo", "galicia") si no aportan.

Responde EXCLUSIVAMENTE con JSON válido:
{"keywords":["...","..."]}`;
}

function buildTranslateResourcePrompt(input: {
  resourceName: string;
  descriptionEs: string;
  targetLang: 'en' | 'fr' | 'pt';
}): string {
  const langNames = { en: 'inglés', fr: 'francés', pt: 'portugués' };
  const langName = langNames[input.targetLang];

  return `Traduce al ${langName} el nombre y una descripción corta del siguiente recurso turístico de O Salnés (Galicia, España).

Nombre original (castellano): ${input.resourceName}

Descripción original (castellano):
"""
${input.descriptionEs.trim()}
"""

Reglas:
  1. Nombres propios (topónimos, monumentos) se mantienen sin traducir.
  2. La descripción debe ser una versión resumida de 2-3 frases (max 300 caracteres), no una traducción literal palabra por palabra.
  3. Tono turístico, natural y acogedor.

Responde EXCLUSIVAMENTE con JSON válido:
{"name":"...","description":"..."}`;
}


// ═══════════ 3) HANDLERS EN EL SWITCH ═══════════
/*
case 'generateSeo': {
  const prompt = buildGenerateSeoPrompt(body);
  const raw = await callGemini(prompt, { temperature: 0.5, maxTokens: 400 });
  try {
    const clean = raw.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    const parsed = JSON.parse(clean);
    return jsonResponse({
      title: (parsed.title ?? '').toString().trim(),
      description: (parsed.description ?? '').toString().trim(),
    });
  } catch {
    return jsonResponse({ title: '', description: '' });
  }
}

case 'suggestKeywords': {
  const prompt = buildSuggestKeywordsPrompt(body.descriptionEs);
  const raw = await callGemini(prompt, { temperature: 0.3, maxTokens: 200 });
  try {
    const clean = raw.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    const parsed = JSON.parse(clean);
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    const cleanKw = keywords
      .map((k) => String(k).toLowerCase().trim())
      .filter((k) => k.length > 0 && k.length < 40)
      .slice(0, 8);
    return jsonResponse({ keywords: cleanKw });
  } catch {
    return jsonResponse({ keywords: [] });
  }
}

case 'translateResource': {
  const prompt = buildTranslateResourcePrompt(body);
  const raw = await callGemini(prompt, { temperature: 0.4, maxTokens: 500 });
  try {
    const clean = raw.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    const parsed = JSON.parse(clean);
    return jsonResponse({
      name: (parsed.name ?? '').toString().trim(),
      description: (parsed.description ?? '').toString().trim(),
    });
  } catch {
    return jsonResponse({ name: '', description: '' });
  }
}
*/

// ═══════════ 4) TEMPERATURAS SUGERIDAS ═══════════
//   generateSeo: 0.5  — necesitamos algo de creatividad pero controlada
//   suggestKeywords: 0.3 — queremos extracción literal, no inventar
//   translateResource: 0.4 — traducción fluida pero fiel


// ═══════════ 5) FALLBACK MOCK (cuando no hay GEMINI_API_KEY) ═══════════
/*
if (!apiKey) {
  if (body.action === 'generateSeo') {
    return jsonResponse({
      title: `${body.resourceName} | O Salnés`,
      description: `Descubre ${body.resourceName}, uno de los lugares más especiales de O Salnés.`,
    });
  }
  if (body.action === 'suggestKeywords') {
    return jsonResponse({ keywords: ['turismo', 'o salnes', 'galicia'] });
  }
  if (body.action === 'translateResource') {
    return jsonResponse({
      name: `[${body.targetLang}] ${body.resourceName}`,
      description: `[${body.targetLang}] Mock translation without GEMINI_API_KEY.`,
    });
  }
}
*/

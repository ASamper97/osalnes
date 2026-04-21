// ──────────────────────────────────────────────────────────────────────────
// PATCH · supabase/functions/ai-writer/index.ts
//
// Añade la acción `suggestImprovements` al Edge Function.
//
// A diferencia de las otras acciones IA (generateSeo, suggestTags, etc.)
// que son puntuales, esta lee el RECURSO COMPLETO y devuelve sugerencias
// accionables distribuidas por paso del wizard.
// ──────────────────────────────────────────────────────────────────────────


// ═══════════ 1) AÑADIR 'suggestImprovements' AL TIPO Action ═══════════
/*
type Action =
  | 'draft' | 'improve' | 'translate' | 'seo' | 'validate'
  | 'categorize' | 'alt_text' | 'suggestTags' | 'genAltText'
  | 'generateSeo' | 'suggestKeywords' | 'translateResource'
  | 'suggestImprovements'; // ← NUEVO
*/

// ═══════════ 2) TIPOS DE ENTRADA/SALIDA ═══════════

interface SuggestImprovementsInput {
  action: 'suggestImprovements';
  snapshot: {
    name: string;
    typeLabel: string | null;
    municipio: string | null;
    descriptionEs: string;
    descriptionGl: string;
    hasCoordinates: boolean;
    hasContactInfo: boolean;
    hasHours: boolean;
    tagCount: number;
    imageCount: number;
    imagesWithoutAltCount: number;
    seoTitleEs: string;
    seoDescriptionEs: string;
    keywords: string[];
    translationCount: number;
  };
}

interface ImprovementSuggestion {
  stepRef: 'identification' | 'content' | 'location' | 'classification' | 'multimedia' | 'seo';
  text: string;
  priority: 'high' | 'medium' | 'low';
}


// ═══════════ 3) BUILDER DEL PROMPT ═══════════

function buildSuggestImprovementsPrompt(input: SuggestImprovementsInput['snapshot']): string {
  return `Eres un consultor SEO y editorial especializado en turismo local gallego. Vas a leer el estado de un recurso turístico y devolver sugerencias concretas y accionables para mejorarlo antes de publicarlo.

Recurso:
  - Nombre: ${input.name}
  - Tipo: ${input.typeLabel ?? 'sin tipología'}
  - Municipio: ${input.municipio ?? 'sin municipio'}
  - Descripción (ES, ${input.descriptionEs.length} chars): """
${input.descriptionEs.trim() || '(vacía)'}
"""
  - Descripción (GL, ${input.descriptionGl.length} chars): """
${input.descriptionGl.trim() || '(vacía)'}
"""
  - Coordenadas: ${input.hasCoordinates ? 'sí' : 'no'}
  - Información de contacto (teléfono/email/web): ${input.hasContactInfo ? 'sí' : 'no'}
  - Horarios definidos: ${input.hasHours ? 'sí' : 'no'}
  - Número de etiquetas: ${input.tagCount}
  - Fotos: ${input.imageCount} (${input.imagesWithoutAltCount} sin descripción alt)
  - Título SEO: "${input.seoTitleEs || '(vacío)'}"
  - Descripción SEO: "${input.seoDescriptionEs || '(vacía)'}"
  - Keywords: ${input.keywords.length > 0 ? input.keywords.join(', ') : '(ninguna)'}
  - Traducciones a otros idiomas: ${input.translationCount}

Tu tarea:
  Analiza el recurso y devuelve entre 3 y 8 sugerencias ESPECÍFICAS y ACCIONABLES.
  No sugerencias genéricas como "mejora el SEO". Sugerencias concretas como:
  "Añade si hay aparcamiento cercano — los visitantes lo preguntan mucho".

Reglas:
  1. Cada sugerencia debe decir QUÉ añadir/cambiar en CASTELLANO, no solo que algo falta.
  2. Prioridad 'high' solo para cosas que impactan seriamente al visitante (falta de info crítica).
  3. Prioridad 'medium' para mejoras de calidad.
  4. Prioridad 'low' para pulidos opcionales.
  5. Máximo 25 palabras por sugerencia. Frases directas.
  6. Reparte entre los 6 pasos del wizard (identification/content/location/classification/multimedia/seo) según donde se aplique cada sugerencia.
  7. NO inventes datos sobre el recurso: usa solo lo que tienes.

Responde EXCLUSIVAMENTE con JSON válido, sin markdown ni texto extra:

{
  "suggestions": [
    {"stepRef":"content","text":"Menciona cómo llegar al recurso, especialmente desde la N-550.","priority":"high"},
    {"stepRef":"location","text":"Añade el horario de invierno — actualmente solo aparece el de verano.","priority":"medium"}
  ]
}

Si el recurso está bien, devuelve array vacío: {"suggestions":[]}`;
}


// ═══════════ 4) HANDLER EN EL SWITCH ═══════════
/*
case 'suggestImprovements': {
  const input = body as SuggestImprovementsInput;

  // Requisito mínimo: descripción suficiente para poder analizar
  if (!input.snapshot?.descriptionEs || input.snapshot.descriptionEs.trim().length < 50) {
    return jsonResponse({ suggestions: [] });
  }

  const prompt = buildSuggestImprovementsPrompt(input.snapshot);

  // Temperatura 0.6 - queremos creatividad acotada
  const raw = await callGemini(prompt, { temperature: 0.6, maxTokens: 800 });

  try {
    const clean = raw.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    const parsed = JSON.parse(clean);
    const arr = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    // Validación estricta de cada item
    const validSteps = ['identification','content','location','classification','multimedia','seo'];
    const validPrios = ['high','medium','low'];
    const valid = arr.filter((s: any) =>
      validSteps.includes(s.stepRef) &&
      validPrios.includes(s.priority) &&
      typeof s.text === 'string' &&
      s.text.trim().length > 0 &&
      s.text.length < 200
    );

    return jsonResponse({ suggestions: valid.slice(0, 8) });
  } catch {
    return jsonResponse({ suggestions: [] });
  }
}
*/


// ═══════════ 5) FALLBACK MOCK (sin GEMINI_API_KEY) ═══════════
/*
if (!apiKey && body.action === 'suggestImprovements') {
  return jsonResponse({
    suggestions: [
      { stepRef: 'content', text: '[mock] Ampliar la descripción con más detalles prácticos (aparcamiento, acceso).', priority: 'high' },
      { stepRef: 'seo',     text: '[mock] El título SEO podría incluir el nombre del municipio.', priority: 'medium' },
    ],
  });
}
*/

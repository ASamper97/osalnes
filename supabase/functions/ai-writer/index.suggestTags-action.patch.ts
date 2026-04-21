// ──────────────────────────────────────────────────────────────────────────
// PATCH · supabase/functions/ai-writer/index.ts
//
// Añade la acción `suggestTags` al Edge Function `ai-writer`.
//
// Esta acción recibe la descripción ES del paso 2 + tipología + municipio
// y devuelve un array de sugerencias de etiquetas con explicación corta
// por cada una (modalidad "explicado" — decisión 4-A del usuario).
// ──────────────────────────────────────────────────────────────────────────


// ═══════════ 1) AÑADIR 'suggestTags' AL TIPO Action ═══════════

// En la declaración actual del tipo de action:
//   type Action = 'draft' | 'improve' | 'translate' | 'seo' | 'validate' | 'categorize' | 'alt_text';
// Añadir 'suggestTags':
type Action =
  | 'draft'
  | 'improve'
  | 'translate'
  | 'seo'
  | 'validate'
  | 'categorize'
  | 'alt_text'
  | 'suggestTags'; // ← NUEVO


// ═══════════ 2) TIPOS DE ENTRADA Y SALIDA ═══════════

interface SuggestTagsInput {
  action: 'suggestTags';
  descriptionEs: string;
  mainTypeKey: string | null;
  municipio: string | null;
  existingTagKeys: string[];
}

interface TagSuggestion {
  tagKey: string;
  labelEs: string;
  reason: string;
}


// ═══════════ 3) CATÁLOGO DE TAGS DISPONIBLES ═══════════
//
// El Edge Function necesita saber qué tags PUEDE proponer para no inventar
// keys que no existen en el catálogo real. El catálogo se carga del mismo
// fichero que usa el frontend (`packages/shared/src/data/tag-catalog.ts`).
//
// Si el Edge Function no puede importar de `packages/shared/` directamente
// (Deno vs TS paths), hacer UNA DE ESTAS:
//
//   Opción A: duplicar el array de `TAG_CATALOG` dentro de este fichero
//             (menos limpio pero más robusto).
//
//   Opción B: exponer el catálogo en una tabla de Supabase y consultarla
//             al arrancar la función (cache en memoria).
//
//   Opción C: pasar el catálogo desde el cliente como parte del payload
//             (NO recomendado — añade peso a cada request).
//
// Opción A es la más simple de arrancar; se migra a B en producción.


// ═══════════ 4) BUILDER DEL PROMPT ═══════════

function buildSuggestTagsPrompt(
  input: SuggestTagsInput,
  availableTags: Array<{ key: string; labelEs: string; groupKey: string; description?: string }>,
): string {
  const typeLabel = humanizeTypeKey(input.mainTypeKey);
  const municipioHint = input.municipio
    ? `en ${input.municipio}, comarca de O Salnés`
    : 'en O Salnés';

  // Filtramos tags ya marcados
  const candidateTags = availableTags.filter(
    (t) => !input.existingTagKeys.includes(t.key),
  );

  // Construimos la lista que le damos a la IA
  const tagsList = candidateTags
    .map((t) => `  - ${t.key}: "${t.labelEs}"${t.description ? ` — ${t.description}` : ''}`)
    .join('\n');

  return `Eres un asistente que clasifica recursos turísticos para un CMS municipal.
Te doy una descripción de un recurso y un catálogo de etiquetas disponibles.
Tu tarea: proponer las etiquetas del catálogo que MEJOR describen el recurso.

Recurso:
  - Tipo: ${typeLabel}
  - Ubicación: ${municipioHint}
  - Descripción: """
${input.descriptionEs.trim()}
"""

Catálogo de etiquetas disponibles (NO propongas ninguna que no esté aquí):
${tagsList}

Reglas:
  1. Propón entre 3 y 8 etiquetas. Menos si el texto es ambiguo, más si es rico.
  2. SOLO etiquetas que tengan EVIDENCIA clara en la descripción. No supongas.
  3. Para cada etiqueta, escribe una razón corta (máximo 20 palabras, en castellano)
     citando qué parte de la descripción la justifica.
  4. Si no hay ninguna etiqueta con evidencia clara, devuelve array vacío.
  5. NO propongas etiquetas de accesibilidad salvo que la descripción lo mencione
     explícitamente (rampa, silla de ruedas, aseo adaptado, etc.).
  6. NO propongas etiquetas del grupo "curaduria-editorial" (son internas del CMS).

Responde EXCLUSIVAMENTE con un JSON válido (sin markdown, sin texto extra) con esta shape:

{
  "suggestions": [
    {
      "tagKey": "caracteristicas.bandera-azul",
      "labelEs": "Bandera azul",
      "reason": "La descripción menciona certificación Q de calidad y bandera azul."
    }
  ]
}

Si no hay sugerencias: { "suggestions": [] }`;
}


// ═══════════ 5) HANDLER EN EL SWITCH DEL Edge Function ═══════════
//
// En el switch del handler principal, añadir el case:
/*
case 'suggestTags': {
  const input = body as SuggestTagsInput;

  // Validaciones de entrada
  if (!input.descriptionEs || input.descriptionEs.trim().length < 20) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cargar catálogo (opción A — duplicado, o opción B — desde BD)
  const catalog = await loadTagCatalog();

  // Construir prompt
  const prompt = buildSuggestTagsPrompt(input, catalog);

  // Llamar a Gemini con temperatura baja (queremos precisión, no creatividad)
  const rawResponse = await callGemini(prompt, { temperature: 0.3, maxTokens: 1200 });

  // La IA debe devolver JSON. Si no lo hace, intentamos extraerlo.
  let parsed: { suggestions?: TagSuggestion[] };
  try {
    // Quitar posibles fences ```json...``` por si se cuelan
    const clean = rawResponse.trim().replace(/^```json\s*/, '').replace(/```$/, '');
    parsed = JSON.parse(clean);
  } catch {
    // La IA no respondió JSON válido. Devolvemos array vacío.
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validación estricta: cada sugerencia debe tener tagKey que EXISTA en el catálogo
  const validSuggestions = (parsed.suggestions ?? []).filter((s) =>
    catalog.some((c) => c.key === s.tagKey)
  );

  return new Response(JSON.stringify({ suggestions: validSuggestions.slice(0, 8) }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
*/


// ═══════════ 6) FALLBACK MOCK ═══════════
//
// Si no hay GEMINI_API_KEY, devolver sugerencias de ejemplo para que el
// frontend pueda probarse sin gastar tokens:
/*
if (!apiKey) {
  const mockSuggestions: TagSuggestion[] = [
    {
      tagKey: 'caracteristicas.al-aire-libre',
      labelEs: 'Al aire libre',
      reason: '[Mock] Fallback sin API key configurada.',
    },
  ];
  return new Response(JSON.stringify({ suggestions: mockSuggestions }));
}
*/


// ═══════════ 7) TEMPERATURA ═══════════
//
// `suggestTags` usa temperatura 0.3 (más baja que `draft` y `improve`).
// Razón: queremos clasificación basada en evidencia, no creatividad. Si
// subimos mucho la temperatura la IA empieza a inventar etiquetas.


// ═══════════ 8) TEST MANUAL ═══════════
//
// POST /functions/v1/ai-writer con:
//   {
//     "action": "suggestTags",
//     "descriptionEs": "Mirador emblemático con vistas a la Ría de Arousa. Acceso accesible con rampa...",
//     "mainTypeKey": "tipo-de-recurso.mirador",
//     "municipio": "Sanxenxo",
//     "existingTagKeys": []
//   }
// →
//   {
//     "suggestions": [
//       { "tagKey": "caracteristicas.al-aire-libre", "labelEs": "Al aire libre", "reason": "Mirador con acceso exterior según la descripción." },
//       { "tagKey": "caracteristicas.accesible-silla-ruedas", "labelEs": "Accesible en silla de ruedas", "reason": "La descripción menciona rampa de acceso accesible." }
//     ]
//   }

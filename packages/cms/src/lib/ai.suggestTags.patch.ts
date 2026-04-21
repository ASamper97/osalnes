/**
 * PATCH · packages/cms/src/lib/ai.ts
 *
 * Este fichero NO se copia directamente. Son las adiciones que Claude Code
 * debe aplicar al módulo `ai.ts` existente para soportar la nueva acción
 * `suggestTags` del Edge Function `ai-writer`.
 *
 * Se añade al final del fichero (después de `aiDraft`, `aiImprove`,
 * `aiTranslate`).
 */

// ═══════════════════════════════════════════════════════════════════════
// AÑADIR AL FINAL DE packages/cms/src/lib/ai.ts
// ═══════════════════════════════════════════════════════════════════════

/**
 * Forma de una sugerencia individual que devuelve el Edge Function.
 *
 * El `reason` es la explicación en castellano que la IA genera para cada
 * etiqueta propuesta (decisión 4-A del usuario: modalidad "explicado").
 */
export interface AiTagSuggestion {
  /** Key del tag, p.ej. "caracteristicas.bandera-azul" */
  tagKey: string;
  /** Etiqueta visible en castellano (el Edge la devuelve para que el cliente no tenga que resolverla) */
  labelEs: string;
  /** Una frase corta en castellano que explica por qué la IA sugiere este tag */
  reason: string;
}

export interface AiSuggestTagsInput {
  /** Descripción del paso 2 en castellano (entrada principal) */
  descriptionEs: string;
  /** Tipología principal del paso 1, para contextualizar */
  mainTypeKey: string | null;
  /** Municipio opcional para mayor contexto */
  municipio: string | null;
  /** Tags ya marcados por el usuario (la IA no los volverá a proponer) */
  existingTagKeys: string[];
}

/**
 * Pide a la IA que proponga etiquetas relevantes basadas en la descripción
 * del recurso. Devuelve array de sugerencias con razón explicativa para
 * cada una. Nunca devuelve más de 8 sugerencias.
 */
export async function aiSuggestTags(
  input: AiSuggestTagsInput,
): Promise<AiTagSuggestion[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-writer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'suggestTags', ...input }),
  });
  if (!res.ok) throw new Error(`ai-writer suggestTags failed: ${res.status}`);
  const data = await res.json();
  // La shape esperada del Edge Function es { suggestions: AiTagSuggestion[] }
  return Array.isArray(data.suggestions) ? (data.suggestions as AiTagSuggestion[]) : [];
}

// NOTA: `SUPABASE_URL` y `SUPABASE_ANON_KEY` ya deben estar importados o
// declarados arriba en el fichero `ai.ts` (los usa `aiDraft`, `aiImprove`,
// `aiTranslate`). Si no lo están, seguir el mismo patrón que esas
// funciones existentes.

/**
 * PATCH · packages/cms/src/lib/ai.ts
 *
 * Añade la función `aiGenAltText` para generar alt text con IA (Gemini
 * Vision). Se llama una vez por imagen desde el paso 5.
 *
 * Este fichero NO se copia directamente. Son instrucciones para Claude
 * Code. Añadir al final del fichero `ai.ts` después de las otras funciones.
 */

// ═══════════════════════════════════════════════════════════════════════
// AÑADIR AL FINAL DE packages/cms/src/lib/ai.ts
// ═══════════════════════════════════════════════════════════════════════

export interface AiGenAltTextInput {
  /** URL pública de la imagen en Supabase Storage */
  imageUrl: string;
  /** Contexto del recurso (mejora la precisión del alt) */
  resourceContext: {
    name: string;
    /** Tipología principal legible (ej. "Playa", "Museo", "Restaurante") */
    typeLabel: string | null;
    municipio: string | null;
  };
}

/**
 * Genera alt text descriptivo para una imagen usando Gemini Vision.
 * Devuelve string con la descripción (15-30 palabras en castellano) o
 * lanza error si falla.
 *
 * Cumple WCAG 2.1 AA criterio 1.1.1 (texto alternativo).
 */
export async function aiGenAltText(input: AiGenAltTextInput): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-writer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'genAltText', ...input }),
  });
  if (!res.ok) throw new Error(`ai-writer genAltText failed: ${res.status}`);
  const data = await res.json();
  return (data.altText ?? '').trim();
}

// NOTA: `SUPABASE_URL` y `SUPABASE_ANON_KEY` deben estar ya importados o
// declarados arriba en el fichero (los usan las otras funciones como
// `aiDraft`, `aiImprove`, `aiTranslate`, `aiSuggestTags`).

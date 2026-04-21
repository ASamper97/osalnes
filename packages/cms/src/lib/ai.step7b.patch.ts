/**
 * PATCH · packages/cms/src/lib/ai.ts
 *
 * Añade `aiSuggestImprovements` al cliente AI para el paso 7b.
 * Añadir al final de `ai.ts` después de las funciones existentes.
 */

// ═══════════════════════════════════════════════════════════════════════
// AÑADIR AL FINAL DE packages/cms/src/lib/ai.ts
// ═══════════════════════════════════════════════════════════════════════

import type { ImprovementSuggestion } from '../components/ImprovementSuggestions';

export interface AiSuggestImprovementsInput {
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

export async function aiSuggestImprovements(
  input: AiSuggestImprovementsInput,
): Promise<ImprovementSuggestion[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-writer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'suggestImprovements', ...input }),
  });
  if (!res.ok) throw new Error(`ai-writer suggestImprovements failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.suggestions) ? (data.suggestions as ImprovementSuggestion[]) : [];
}

// NOTA: `SUPABASE_URL` y `SUPABASE_ANON_KEY` ya deben estar importados o
// declarados arriba del fichero (los usan las otras funciones).

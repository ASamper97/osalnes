/**
 * PATCH · packages/cms/src/lib/ai.ts
 *
 * Añade 3 funciones al cliente AI para el paso 6:
 *   - aiGenerateSeo         — genera título + descripción SEO optimizados
 *   - aiSuggestKeywords     — sugiere 5-8 keywords
 *   - aiTranslateResource   — traduce nombre + descripción a un idioma
 *
 * Añadir al final de `ai.ts` después de las funciones existentes
 * (aiDraft, aiImprove, aiTranslate, aiSuggestTags, aiGenAltText).
 */

// ═══════════════════════════════════════════════════════════════════════
// 1. GENERAR SEO (título + descripción SEO)
// ═══════════════════════════════════════════════════════════════════════

export interface AiGenerateSeoInput {
  descriptionEs: string;
  resourceName: string;
  /** Idioma objetivo: 'es' o 'gl' */
  lang: 'es' | 'gl';
  /** Tipología principal, para contextualizar */
  typeLabel?: string | null;
  municipio?: string | null;
}

export interface AiGeneratedSeo {
  title: string;
  description: string;
}

export async function aiGenerateSeo(input: AiGenerateSeoInput): Promise<AiGeneratedSeo> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-writer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'generateSeo', ...input }),
  });
  if (!res.ok) throw new Error(`ai-writer generateSeo failed: ${res.status}`);
  const data = await res.json();
  return {
    title: (data.title ?? '').trim(),
    description: (data.description ?? '').trim(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 2. SUGERIR KEYWORDS
// ═══════════════════════════════════════════════════════════════════════

export async function aiSuggestKeywords(descriptionEs: string): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-writer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'suggestKeywords', descriptionEs }),
  });
  if (!res.ok) throw new Error(`ai-writer suggestKeywords failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.keywords) ? (data.keywords as string[]) : [];
}

// ═══════════════════════════════════════════════════════════════════════
// 3. TRADUCIR RECURSO (nombre + descripción → idioma destino)
// ═══════════════════════════════════════════════════════════════════════

export interface AiTranslateResourceInput {
  resourceName: string;
  descriptionEs: string;
  /** Idioma destino (en/fr/pt) */
  targetLang: 'en' | 'fr' | 'pt';
}

export interface AiTranslationResult {
  name: string;
  description: string;
}

export async function aiTranslateResource(
  input: AiTranslateResourceInput,
): Promise<AiTranslationResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-writer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'translateResource', ...input }),
  });
  if (!res.ok) throw new Error(`ai-writer translateResource failed: ${res.status}`);
  const data = await res.json();
  return {
    name: (data.name ?? '').trim(),
    description: (data.description ?? '').trim(),
  };
}

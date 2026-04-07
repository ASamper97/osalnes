/**
 * AI Client — Utilities for calling the ai-writer Edge Function
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const AI_URL = `${SUPABASE_URL}/functions/v1/ai-writer`;
const IMPORT_URL = `${SUPABASE_URL}/functions/v1/import-from-url`;

interface AiRequestBase {
  action: string;
  text?: string;
  from?: string;
  to?: string;
  lang?: string;
  context?: Record<string, unknown>;
}

interface AiResponse<T = string> {
  action: string;
  result: T;
  tokens_used: number;
  duration_ms: number;
  model: string;
  mock?: boolean;
  error?: string;
}

async function callAi<T = string>(body: AiRequestBase): Promise<AiResponse<T>> {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexión con IA' }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  return res.json();
}

/** Improve a tourism description */
export async function aiImprove(text: string): Promise<string> {
  const res = await callAi({ action: 'improve', text });
  return typeof res.result === 'string' ? res.result : text;
}

/** Context-aware tourism translation */
export async function aiTranslate(text: string, from: string, to: string): Promise<string> {
  const res = await callAi({ action: 'translate', text, from, to });
  return typeof res.result === 'string' ? res.result : text;
}

/** Generate SEO title and description */
export interface SeoResult {
  title_es: string;
  desc_es: string;
  title_gl: string;
  desc_gl: string;
}

export async function aiGenerateSeo(context: {
  name: string;
  description: string;
  type: string;
  municipality: string;
}): Promise<SeoResult> {
  const res = await callAi<SeoResult>({
    action: 'seo',
    text: context.description,
    context: {
      name: context.name,
      description: context.description,
      type: context.type,
      municipality: context.municipality,
    },
  });

  if (typeof res.result === 'object' && res.result !== null) {
    return res.result;
  }

  return { title_es: '', desc_es: '', title_gl: '', desc_gl: '' };
}

/** Validate content quality */
export interface ValidationResult {
  score: number;
  level: 'excelente' | 'bueno' | 'mejorable' | 'incompleto';
  issues: string[];
  suggestions: string[];
  missing_fields: string[];
  seo_ready: boolean;
  translation_quality: string;
}

export async function aiValidate(context: Record<string, unknown>): Promise<ValidationResult> {
  const res = await callAi<ValidationResult>({
    action: 'validate',
    context,
  });

  if (typeof res.result === 'object' && res.result !== null) {
    return res.result as ValidationResult;
  }

  return {
    score: 0,
    level: 'incompleto',
    issues: ['No se pudo evaluar'],
    suggestions: [],
    missing_fields: [],
    seo_ready: false,
    translation_quality: 'ausente',
  };
}

/** Suggest categories and tourist types */
export interface CategorizationResult {
  tourist_types: string[];
  reasoning: string;
}

export async function aiCategorize(context: {
  name: string;
  description: string;
  type: string;
}): Promise<CategorizationResult> {
  const res = await callAi<CategorizationResult>({
    action: 'categorize',
    text: context.description,
    context: {
      name: context.name,
      type: context.type,
      description: context.description,
    },
  });

  if (typeof res.result === 'object' && res.result !== null) {
    return res.result as CategorizationResult;
  }

  return { tourist_types: [], reasoning: '' };
}

/** Import resource data from an external URL using AI */
export interface ImportedResource {
  name?: string;
  rdf_type?: string;
  description?: string;
  address?: string;
  postal_code?: string;
  telephone?: string[];
  email?: string[];
  url?: string;
  opening_hours?: string;
  latitude?: number;
  longitude?: number;
  tourist_types?: string[];
  rating_value?: number;
  cuisine?: string[];
  extracted_from?: string;
}

export async function aiImportFromUrl(url: string): Promise<ImportedResource> {
  const res = await fetch(IMPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexion con IA' }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  const data = await res.json();
  return data.result || {};
}

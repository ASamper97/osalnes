/**
 * AI Client — Utilities for calling the ai-writer Edge Function
 *
 * Audit C4 — All AI endpoints now require a valid Supabase JWT (the
 * functions were configured with verify_jwt = false, which made them
 * an open Gemini proxy for anyone with the public anon key). We add
 * the bearer token via getAuthHeaders() from api.ts so the cached
 * session token is reused (no extra round trip per call).
 */

import { getAuthHeaders } from './api';
import { TAGS_BY_KEY, TAGS_BY_GROUP } from '@osalnes/shared/data/tag-catalog';
import { getWizardGroupsForType } from '@osalnes/shared/data/resource-type-catalog';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const AI_URL = `${SUPABASE_URL}/functions/v1/ai-writer`;
const IMPORT_URL = `${SUPABASE_URL}/functions/v1/import-from-url`;
const BATCH_URL = `${SUPABASE_URL}/functions/v1/ai-batch`;

interface AiRequestBase {
  action: string;
  text?: string;
  from?: string;
  to?: string;
  lang?: string;
  context?: Record<string, unknown>;
  // Campos extra usados por la acción `draft` (paso 2 · t2). El edge
  // function `ai-writer` los lee directamente del body. targetLang se
  // comparte con `translateResource` del paso 6 (widening a EN/FR/PT).
  name?: string;
  typeKey?: string | null;
  municipio?: string | null;
  // Campos extra usados por la acción `suggestTags` (paso 4 · t2/t4).
  descriptionEs?: string;
  mainTypeKey?: string | null;
  existingTagKeys?: string[];
  availableTags?: Array<{
    key: string;
    labelEs: string;
    groupKey: string;
    groupLabel: string;
    description?: string;
  }>;
  // Campos extra usados por la acción `genAltText` (paso 5 · t2/t3). El
  // edge function baja la imagen de `imageUrl` (URL pública de Supabase
  // Storage) y la pasa a Gemini Vision junto con el contexto del recurso.
  imageUrl?: string;
  resourceContext?: {
    name: string;
    typeLabel: string | null;
    municipio: string | null;
  };
  // Campos extra usados por las acciones del paso 6 (generateSeo /
  // suggestKeywords / translateResource). Los 3 leen `descriptionEs` del
  // paso 2 como entrada principal; generateSeo y translateResource
  // además necesitan `resourceName` y target lang.
  resourceName?: string;
  targetLang?: 'es' | 'gl' | 'en' | 'fr' | 'pt';
  typeLabel?: string | null;
  // Campos extra usados por `suggestImprovements` (paso 7b · t3). El
  // snapshot es un resumen del recurso construido por el componente
  // padre (ResourceWizardPage) para que la IA genere sugerencias
  // concretas por paso.
  snapshot?: {
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

interface AiResponse<T = string> {
  action: string;
  result: T;
  tokens_used: number;
  duration_ms: number;
  model: string;
  mock?: boolean;
  error?: string;
}

/** Build auth headers with bearer + apikey (Supabase Edge Functions need both). */
async function aiHeaders(): Promise<Record<string, string>> {
  const auth = await getAuthHeaders();
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    ...auth, // Authorization: Bearer ... when logged in
  };
}

async function callAi<T = string>(body: AiRequestBase): Promise<AiResponse<T>> {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexión con IA' }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  return res.json();
}

/**
 * Improve a tourism description.
 *
 * Dos firmas soportadas:
 *   - Posicional `aiImprove(text)` → legacy (RichTextEditor, AiWritingAssistant).
 *   - Objeto `aiImprove({ text, lang?, context? })` → nueva (paso 2 del wizard).
 * Ambas devuelven la propuesta como string. Se mantiene compatibilidad sin
 * romper consumers actuales.
 */
export interface AiImproveInput {
  text: string;
  lang?: string;
  context?: { name?: string; typeKey?: string | null };
}
export async function aiImprove(text: string): Promise<string>;
export async function aiImprove(input: AiImproveInput): Promise<string>;
export async function aiImprove(arg: string | AiImproveInput): Promise<string> {
  const text = typeof arg === 'string' ? arg : arg.text;
  const body: AiRequestBase = { action: 'improve', text };
  if (typeof arg !== 'string') {
    if (arg.lang) body.lang = arg.lang;
    if (arg.context) body.context = arg.context as Record<string, unknown>;
  }
  const res = await callAi(body);
  return typeof res.result === 'string' ? res.result : text;
}

/**
 * Context-aware tourism translation. Mismas dos firmas que aiImprove:
 *   - Posicional `aiTranslate(text, from, to)` → legacy.
 *   - Objeto `aiTranslate({ text, from, to })` → paso 2 + useBackgroundTranslation.
 */
export interface AiTranslateInput {
  text: string;
  from: string;
  to: string;
}
export async function aiTranslate(text: string, from: string, to: string): Promise<string>;
export async function aiTranslate(input: AiTranslateInput): Promise<string>;
export async function aiTranslate(
  arg: string | AiTranslateInput,
  from?: string,
  to?: string,
): Promise<string> {
  const text = typeof arg === 'string' ? arg : arg.text;
  const fromLang = typeof arg === 'string' ? from! : arg.from;
  const toLang = typeof arg === 'string' ? to! : arg.to;
  const res = await callAi({ action: 'translate', text, from: fromLang, to: toLang });
  return typeof res.result === 'string' ? res.result : text;
}

/**
 * Generar un borrador inicial de descripción partiendo solo de nombre +
 * tipología + municipio (paso 2 · t3). Requiere el action `draft` en la
 * edge function ai-writer (paso 2 · t2).
 */
export async function aiDraft(input: {
  name: string;
  typeKey: string | null;
  municipio: string | null;
  targetLang: 'es' | 'gl';
}): Promise<string> {
  const res = await callAi({
    action: 'draft',
    name: input.name,
    typeKey: input.typeKey,
    municipio: input.municipio,
    targetLang: input.targetLang,
  });
  return typeof res.result === 'string' ? res.result : '';
}

// ─────────────────────────────────────────────────────────────────────────
// suggestTags — sugeridor de etiquetas con explicación (paso 4 · t2)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Una sugerencia individual que devuelve el Edge Function. El `reason` es
 * la explicación en castellano de por qué la IA propone este tag
 * (modalidad "explicado", decisión 4-A del usuario).
 */
export interface AiTagSuggestion {
  /** Key del tag, p.ej. "caracteristicas.bandera-azul" */
  tagKey: string;
  /** Etiqueta visible en castellano (el Edge la devuelve para que el cliente no tenga que resolverla) */
  labelEs: string;
  /** Frase corta que explica por qué la IA propone este tag */
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

interface SuggestTagsResult {
  suggestions: AiTagSuggestion[];
}

/** Grupos que nunca se sugieren automáticamente (se controlan en otros pasos). */
const SUGGEST_TAGS_EXCLUDED_GROUPS = new Set([
  'tipo-de-recurso', // se fija en paso 1
  'municipio', // se fija en paso 1
  'curaduria-editorial', // curaduría humana, no IA
]);

/**
 * Construye el catálogo de tags candidatos a enviar a la IA, filtrando
 * por grupos aplicables al tipo del recurso y excluyendo los ya marcados.
 */
function buildAvailableTagsCatalog(
  mainTypeKey: string | null,
  existingTagKeys: string[],
): NonNullable<AiRequestBase['availableTags']> {
  const resourceTypeLabel = mainTypeKey ? (TAGS_BY_KEY[mainTypeKey]?.value ?? null) : null;
  const applicableGroups = getWizardGroupsForType(resourceTypeLabel);
  const groupSet = new Set(applicableGroups);
  const existingSet = new Set(existingTagKeys);

  const out: NonNullable<AiRequestBase['availableTags']> = [];
  for (const [groupKey, tags] of Object.entries(TAGS_BY_GROUP)) {
    if (!groupSet.has(groupKey)) continue;
    if (SUGGEST_TAGS_EXCLUDED_GROUPS.has(groupKey)) continue;
    for (const tag of tags) {
      if (existingSet.has(tag.key)) continue;
      out.push({
        key: tag.key,
        labelEs: tag.label,
        groupKey: tag.groupKey,
        groupLabel: groupKey,
        description: tag.notes,
      });
    }
  }
  return out;
}

/**
 * Propone etiquetas relevantes basadas en la descripción del recurso.
 * Devuelve array con hasta 8 sugerencias, cada una con su razón.
 * Requiere el action `suggestTags` en la edge function (paso 4 · t4).
 */
export async function aiSuggestTags(
  input: AiSuggestTagsInput,
): Promise<AiTagSuggestion[]> {
  const availableTags = buildAvailableTagsCatalog(input.mainTypeKey, input.existingTagKeys);
  const res = await callAi<SuggestTagsResult>({
    action: 'suggestTags',
    descriptionEs: input.descriptionEs,
    mainTypeKey: input.mainTypeKey,
    municipio: input.municipio,
    existingTagKeys: input.existingTagKeys,
    availableTags,
  });
  if (
    res.result &&
    typeof res.result === 'object' &&
    Array.isArray((res.result as SuggestTagsResult).suggestions)
  ) {
    return (res.result as SuggestTagsResult).suggestions;
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// genAltText — alt text WCAG 2.1 AA con Gemini Vision (paso 5 · t2)
// ─────────────────────────────────────────────────────────────────────────

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
 * Genera alt text descriptivo para una imagen usando Gemini Vision
 * (modalidad `gemini-*-vision`). Devuelve string con la descripción
 * (15-30 palabras en castellano). Si falla o no hay GEMINI_API_KEY, el
 * edge function devuelve un mock "Imagen de {name} en {municipio}" para
 * no romper el frontend. Cumple WCAG 2.1 AA criterio 1.1.1.
 *
 * Requiere el action `genAltText` en el edge function (paso 5 · t3).
 */
export async function aiGenAltText(input: AiGenAltTextInput): Promise<string> {
  const res = await callAi<string>({
    action: 'genAltText',
    imageUrl: input.imageUrl,
    resourceContext: input.resourceContext,
  });
  return typeof res.result === 'string' ? res.result.trim() : '';
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 6 · t2 — 3 acciones SEO (generateSeo, suggestKeywords, translateResource)
// ─────────────────────────────────────────────────────────────────────────

export interface AiGenerateSeoInput {
  descriptionEs: string;
  resourceName: string;
  /** Idioma objetivo del SEO: 'es' o 'gl' */
  lang: 'es' | 'gl';
  typeLabel?: string | null;
  municipio?: string | null;
}

export interface AiGeneratedSeo {
  title: string;
  description: string;
}

/**
 * Genera título + descripción SEO optimizados para un idioma base (ES o GL)
 * a partir de la descripción del paso 2. Requiere el action `generateSeo`
 * en el edge function (paso 6 · t3).
 */
export async function aiGenerateSeo(input: AiGenerateSeoInput): Promise<AiGeneratedSeo> {
  const res = await callAi<AiGeneratedSeo>({
    action: 'generateSeo',
    descriptionEs: input.descriptionEs,
    resourceName: input.resourceName,
    targetLang: input.lang,
    typeLabel: input.typeLabel ?? null,
    municipio: input.municipio ?? null,
  });
  if (res.result && typeof res.result === 'object') {
    const r = res.result as AiGeneratedSeo;
    return {
      title: (r.title ?? '').trim(),
      description: (r.description ?? '').trim(),
    };
  }
  return { title: '', description: '' };
}

/**
 * Propone 5-8 keywords a partir de la descripción ES del paso 2. Requiere
 * el action `suggestKeywords` en el edge function (paso 6 · t3).
 */
export async function aiSuggestKeywords(descriptionEs: string): Promise<string[]> {
  const res = await callAi<{ keywords: string[] }>({
    action: 'suggestKeywords',
    descriptionEs,
  });
  if (res.result && typeof res.result === 'object' && Array.isArray((res.result as { keywords: unknown }).keywords)) {
    return ((res.result as { keywords: string[] }).keywords ?? [])
      .filter((k) => typeof k === 'string' && k.trim().length > 0)
      .map((k) => k.trim());
  }
  return [];
}

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

/**
 * Traduce nombre + descripción corta del recurso a EN/FR/PT. Distinto de
 * `aiTranslate` legacy (que traduce textos largos palabra por palabra):
 * este action está optimizado para generar la ficha en el idioma destino
 * manteniendo tono turístico. Requiere el action `translateResource` en
 * el edge function (paso 6 · t3).
 */
export async function aiTranslateResource(
  input: AiTranslateResourceInput,
): Promise<AiTranslationResult> {
  const res = await callAi<AiTranslationResult>({
    action: 'translateResource',
    resourceName: input.resourceName,
    descriptionEs: input.descriptionEs,
    targetLang: input.targetLang,
  });
  if (res.result && typeof res.result === 'object') {
    const r = res.result as AiTranslationResult;
    return {
      name: (r.name ?? '').trim(),
      description: (r.description ?? '').trim(),
    };
  }
  return { name: '', description: '' };
}

/**
 * Generate SEO title + description (ES+GL en una sola llamada).
 *
 * DEPRECATED (paso 6 · t2) — la interfaz nueva es `aiGenerateSeo` (un
 * idioma por llamada, shape `{title, description}`). Mantenemos esta
 * firma legacy hasta que T4 borre el componente `AiSeoGenerator` y el
 * bloque legacy del paso 6 del wizard.
 */
export interface SeoResult {
  title_es: string;
  desc_es: string;
  title_gl: string;
  desc_gl: string;
}

export async function aiGenerateSeoLegacy(context: {
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

/** Suggest UNE 178503 tag keys from a resource description (guía-burros v2). */
export interface CategorizationResult {
  suggested_keys: string[];
  reasoning: string;
}

/** Tag descriptor sent to the edge function as catálogo aplicable. */
export interface ApplicableTag {
  key: string;
  label: string;
  field: string;
}

export async function aiCategorize(context: {
  name: string;
  description: string;
  type: string;
  applicableTags: ApplicableTag[];
}): Promise<CategorizationResult> {
  const res = await callAi<CategorizationResult>({
    action: 'categorize',
    text: context.description,
    context: {
      name: context.name,
      type: context.type,
      description: context.description,
      applicableTags: context.applicableTags,
    },
  });

  // Valida las claves devueltas contra el catálogo (defensa contra
  // alucinaciones del modelo — solo dejamos pasar las que existen).
  let parsed: CategorizationResult = { suggested_keys: [], reasoning: '' };
  if (typeof res.result === 'object' && res.result !== null) {
    parsed = res.result as CategorizationResult;
  }
  const suggested_keys = (parsed.suggested_keys ?? []).filter(
    (k) => typeof k === 'string' && TAGS_BY_KEY[k] !== undefined,
  );
  return { suggested_keys, reasoning: parsed.reasoning ?? '' };
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
    headers: await aiHeaders(),
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexion con IA' }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  const data = await res.json();
  return data.result || {};
}

/** Run an AI action over a batch of resources */
export type BatchAction = 'translate' | 'improve' | 'seo' | 'validate' | 'categorize';

export interface BatchResultItem {
  id: string;
  slug: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  data?: unknown;
}

export interface BatchResponse {
  action: string;
  processed: number;
  completed: number;
  errors: number;
  skipped: number;
  duration_ms: number;
  results: BatchResultItem[];
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 7b · t3 — suggestImprovements (sugerencias IA concretas por paso)
// ─────────────────────────────────────────────────────────────────────────

export interface AiSuggestImprovementsInput {
  snapshot: NonNullable<AiRequestBase['snapshot']>;
}

/**
 * Una sugerencia individual devuelta por el Edge Function. El `stepRef`
 * es una QualityStep (`identification/content/location/...`) para que el
 * componente pueda saltar al paso afectado con un clic.
 */
export interface AiImprovementSuggestion {
  stepRef: 'identification' | 'content' | 'location' | 'classification' | 'multimedia' | 'seo';
  text: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Pide a la IA sugerencias concretas de mejora para el recurso (paso 7b).
 * A diferencia del motor local `auditResource` (que dice "descripción
 * corta, 12 palabras"), la IA genera sugerencias de contenido ("añade
 * cómo llegar, menciona aparcamiento cercano, el horario de invierno
 * no está claro").
 *
 * Requiere el action `suggestImprovements` en el edge function
 * (paso 7b · t3) y consume el snapshot construido por el wizard padre.
 */
export async function aiSuggestImprovements(
  input: AiSuggestImprovementsInput,
): Promise<AiImprovementSuggestion[]> {
  const res = await callAi<{ suggestions: AiImprovementSuggestion[] }>({
    action: 'suggestImprovements',
    snapshot: input.snapshot,
  });
  if (
    res.result &&
    typeof res.result === 'object' &&
    Array.isArray((res.result as { suggestions: unknown }).suggestions)
  ) {
    const arr = (res.result as { suggestions: unknown[] }).suggestions;
    // Filtrado defensivo: la IA a veces inventa stepRef; validamos el
    // set de valores permitidos.
    const allowed = new Set(['identification', 'content', 'location', 'classification', 'multimedia', 'seo']);
    const allowedPrio = new Set(['high', 'medium', 'low']);
    return arr.filter((s): s is AiImprovementSuggestion => {
      if (!s || typeof s !== 'object') return false;
      const o = s as Record<string, unknown>;
      return (
        typeof o.stepRef === 'string' && allowed.has(o.stepRef) &&
        typeof o.text === 'string' && o.text.trim().length > 0 &&
        typeof o.priority === 'string' && allowedPrio.has(o.priority)
      );
    });
  }
  return [];
}

export const BATCH_MAX_SIZE = 15;

export async function aiBatch(
  action: BatchAction,
  resourceIds: string[],
  options?: { target_lang?: string },
): Promise<BatchResponse> {
  const res = await fetch(BATCH_URL, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({
      action,
      resource_ids: resourceIds,
      target_lang: options?.target_lang,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de conexion con IA' }));
    throw new Error(err.error || `Error ${res.status}`);
  }

  return res.json();
}

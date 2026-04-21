/**
 * Modelo de datos SEO e idiomas (Paso 6)
 *
 * Alineado con:
 *   - UNE 178503 §10.1.12 `hasDescription.keywords` + `hasMultimedia.image`
 *   - Pliego §5.1.7 "Control de indexación y optimización técnica"
 *   - schema.org Article.headline + description + image + inLanguage
 *   - Open Graph Protocol (og:title, og:description, og:image, og:url)
 *   - Twitter Cards (summary_large_image)
 *
 * El shape SEO no es un campo suelto; es un bloque independiente con su
 * propia validación, preview y auditoría.
 */

// ─── Idiomas soportados ───────────────────────────────────────────────

/** Idioma base del sitio — siempre rellenado en paso 2 */
export type BaseLang = 'es' | 'gl';

/** Idiomas adicionales que se pueden traducir */
export type AdditionalLang = 'en' | 'fr' | 'pt';

/** Cualquier idioma (base + adicional) */
export type AnyLang = BaseLang | AdditionalLang;

export const ADDITIONAL_LANGS: AdditionalLang[] = ['en', 'fr', 'pt'];

export const LANG_LABELS: Record<AnyLang, string> = {
  es: 'Castellano',
  gl: 'Gallego',
  en: 'Inglés',
  fr: 'Francés',
  pt: 'Portugués',
};

// ─── SEO por idioma ────────────────────────────────────────────────────

export interface SeoByLang {
  /** Título SEO para <title> y og:title */
  title: string;
  /** Descripción SEO para <meta name="description"> y og:description */
  description: string;
}

// ─── Traducción adicional por idioma ───────────────────────────────────

export interface TranslationByLang {
  /** Nombre del recurso traducido (ej. "Beach of Lanzada" en EN) */
  name: string;
  /** Descripción corta traducida */
  description: string;
}

// ─── Bloque SEO completo del recurso ───────────────────────────────────

export interface ResourceSeo {
  /** SEO por idioma base (ES y GL obligatorios; el resto opcional pero recomendado) */
  byLang: Partial<Record<AnyLang, SeoByLang>>;

  /**
   * Traducciones adicionales a EN/FR/PT. No incluye GL porque GL es
   * idioma base del paso 2. No incluye ES por la misma razón.
   */
  translations: Partial<Record<AdditionalLang, TranslationByLang>>;

  /**
   * Slug editable (decisión 3-B: editable solo si no está publicado).
   * Se valida en el cliente con `isValidSlug()`.
   */
  slug: string;

  /** Indexación en buscadores (decisión 4-A: visible por defecto) */
  indexable: boolean;

  /**
   * Imagen Open Graph. Si es `null`, se usará la imagen principal del
   * paso 5 automáticamente (decisión 5-A).
   */
  ogImageOverridePath: string | null;

  /** Keywords / palabras clave (decisión 6-A: IA + manual) */
  keywords: string[];

  /** Canonical URL opcional (solo admin; no aparece en la UI normal) */
  canonicalUrl: string | null;
}

export function emptyResourceSeo(): ResourceSeo {
  return {
    byLang: {},
    translations: {},
    slug: '',
    indexable: true,
    ogImageOverridePath: null,
    keywords: [],
    canonicalUrl: null,
  };
}

// ─── Límites recomendados ──────────────────────────────────────────────

export const SEO_LIMITS = {
  title: {
    /** Mínimo útil; por debajo Google puede descartar el título */
    recommendedMin: 30,
    /** Ideal para no truncar */
    recommendedMax: 60,
    /** Límite hard; por encima Google trunca con "…" */
    hardMax: 70,
  },
  description: {
    recommendedMin: 120,
    recommendedMax: 160,
    hardMax: 300,
  },
  slug: {
    recommendedMax: 60,
    hardMax: 100,
  },
  keywords: {
    recommendedMin: 3,
    recommendedMax: 8,
    hardMax: 12,
  },
} as const;

// ─── Helpers de validación ─────────────────────────────────────────────

/**
 * Slug válido: minúsculas ASCII, números, guiones; sin acentos ni
 * espacios; sin guiones al principio o al final; longitud entre 1 y 100.
 */
export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length > SEO_LIMITS.slug.hardMax) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/**
 * Genera slug desde un nombre. Quita acentos, espacios, símbolos.
 * No es equivalente a URL-encoding — esto devuelve un slug bonito para
 * `/recurso/mi-recurso-cambados`.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SEO_LIMITS.slug.recommendedMax);
}

/** Cuenta caracteres sin emojis ni espacios iniciales/finales */
export function countVisibleChars(s: string): number {
  return s.trim().length;
}

// ─── Estado visual del contador ────────────────────────────────────────

export type FieldStatus = 'empty' | 'too-short' | 'ok' | 'too-long' | 'over-hard';

/** Calcula el status de un contador (título o descripción) */
export function getLengthStatus(
  value: string,
  limits: { recommendedMin: number; recommendedMax: number; hardMax: number },
): FieldStatus {
  const n = countVisibleChars(value);
  if (n === 0) return 'empty';
  if (n < limits.recommendedMin) return 'too-short';
  if (n > limits.hardMax) return 'over-hard';
  if (n > limits.recommendedMax) return 'too-long';
  return 'ok';
}

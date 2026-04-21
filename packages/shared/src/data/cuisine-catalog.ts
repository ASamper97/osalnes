/**
 * Catálogo de tipos de cocina alineado con UNE 178503 / schema.org servesCuisine
 *
 * Fuente: borrador PNE 178503 §7.7 "Atributo servesCuisine" (diciembre 2020).
 * El código en mayúsculas es el valor que se exporta al PID; la etiqueta ES
 * es lo que ve el funcionario en la UI.
 *
 * Si hace falta añadir una cocina nueva (ej. "ANDALUSIAN", "GALICIAN"), la
 * norma permite extender la lista pero recomienda usar el genérico cuando
 * exista (ej. "SPANISH" para cocina gallega). Seguimos ese criterio: para
 * O Salnés marcamos "SPANISH" + "FISH AND SEAFOOD" en la mayoría de los
 * casos, y dejamos la puerta abierta a extensiones futuras sin romper el
 * export.
 */

export interface CuisineType {
  /** Código UNE 178503 (MAYÚSCULAS, se exporta literal al PID) */
  code: string;
  /** Etiqueta visible en castellano */
  labelEs: string;
  /** Etiqueta visible en gallego */
  labelGl: string;
  /**
   * Relevancia en O Salnés. Los valores `high` aparecen arriba en el
   * selector, `medium` debajo, `low` al final tras un separador.
   */
  relevance: 'high' | 'medium' | 'low';
}

export const CUISINE_CATALOG: CuisineType[] = [
  // ─── Altamente relevantes para O Salnés (arriba en el selector) ───
  { code: 'SPANISH',          labelEs: 'Española',              labelGl: 'Española',                relevance: 'high' },
  { code: 'FISH AND SEAFOOD', labelEs: 'Pescados y mariscos',   labelGl: 'Peixes e mariscos',       relevance: 'high' },
  { code: 'TAPAS',            labelEs: 'Tapas, raciones y pinchos', labelGl: 'Tapas, racións e petiscos', relevance: 'high' },
  { code: 'RICES',            labelEs: 'Arroces',               labelGl: 'Arroces',                 relevance: 'high' },
  { code: 'HOME COOKING',     labelEs: 'Casera',                labelGl: 'Caseira',                 relevance: 'high' },
  { code: 'HAUTE CUISINE',    labelEs: 'Alta cocina',           labelGl: 'Alta cociña',             relevance: 'high' },
  { code: 'SIGNATURE CUISINE',labelEs: 'De autor',              labelGl: 'De autor',                relevance: 'high' },
  { code: 'SEASONAL CUISINE', labelEs: 'De temporada',          labelGl: 'De tempada',              relevance: 'high' },
  { code: 'BEACH BAR',        labelEs: 'Chiringuito',           labelGl: 'Chiringuito',             relevance: 'high' },

  // ─── Relevancia media ────────────────────────────────────────────
  { code: 'VEGETARIAN',       labelEs: 'Vegetariana',           labelGl: 'Vexetariana',             relevance: 'medium' },
  { code: 'VEGAN',            labelEs: 'Vegana',                labelGl: 'Vegana',                  relevance: 'medium' },
  { code: 'ITALIAN',          labelEs: 'Italiana',              labelGl: 'Italiana',                relevance: 'medium' },
  { code: 'PIZZA',            labelEs: 'Pizzería',              labelGl: 'Pizzaría',                relevance: 'medium' },
  { code: 'HAMBURGUER',       labelEs: 'Hamburguesería',        labelGl: 'Hamburguesaría',          relevance: 'medium' },
  { code: 'FAST FOOD',        labelEs: 'Comida rápida',         labelGl: 'Comida rápida',           relevance: 'medium' },
  { code: 'FUSION',           labelEs: 'Fusión',                labelGl: 'Fusión',                  relevance: 'medium' },

  // ─── Relevancia baja (poco comunes en O Salnés) ──────────────────
  { code: 'AFRICAN',          labelEs: 'Africana',              labelGl: 'Africana',                relevance: 'low' },
  { code: 'ARGENTINIAN',      labelEs: 'Argentina',             labelGl: 'Arxentina',               relevance: 'low' },
  { code: 'BRAZILIAN',        labelEs: 'Brasileña',             labelGl: 'Brasileira',              relevance: 'low' },
  { code: 'CHINESE',          labelEs: 'China',                 labelGl: 'Chinesa',                 relevance: 'low' },
  { code: 'FRENCH',           labelEs: 'Francesa',              labelGl: 'Francesa',                relevance: 'low' },
  { code: 'GERMAN',           labelEs: 'Alemana',               labelGl: 'Alemá',                   relevance: 'low' },
  { code: 'GREEK',            labelEs: 'Griega',                labelGl: 'Grega',                   relevance: 'low' },
  { code: 'INDIAN',           labelEs: 'India',                 labelGl: 'India',                   relevance: 'low' },
  { code: 'JAPANESE',         labelEs: 'Japonesa',              labelGl: 'Xaponesa',                relevance: 'low' },
  { code: 'KEBAB',            labelEs: 'Kebab',                 labelGl: 'Kebab',                   relevance: 'low' },
  { code: 'KOREAN',           labelEs: 'Coreana',               labelGl: 'Coreana',                 relevance: 'low' },
  { code: 'LATIN AMERICAN',   labelEs: 'Latinoamericana',       labelGl: 'Latinoamericana',         relevance: 'low' },
  { code: 'MACROBIOTIC',      labelEs: 'Macrobiótica',          labelGl: 'Macrobiótica',            relevance: 'low' },
  { code: 'MEXICAN',          labelEs: 'Mexicana',              labelGl: 'Mexicana',                relevance: 'low' },
  { code: 'MIDDLE EAST',      labelEs: 'Oriente Medio',         labelGl: 'Oriente Medio',           relevance: 'low' },
  { code: 'PERUVIAN',         labelEs: 'Peruana',               labelGl: 'Peruana',                 relevance: 'low' },
  { code: 'THAI',             labelEs: 'Tailandesa',            labelGl: 'Tailandesa',              relevance: 'low' },
];

export const CUISINE_BY_CODE: Record<string, CuisineType> = Object.fromEntries(
  CUISINE_CATALOG.map((c) => [c.code, c]),
);

/** Busca una cocina por código UNE. Devuelve `null` si no existe. */
export function findCuisine(code: string | null | undefined): CuisineType | null {
  if (!code) return null;
  return CUISINE_BY_CODE[code] ?? null;
}

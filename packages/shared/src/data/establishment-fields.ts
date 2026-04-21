/**
 * Mapeo de tipología principal → qué bloques del paso 4 son relevantes
 *
 * El paso 4 ("Clasificación") muestra tres bloques condicionales:
 *
 *   1. Clasificación oficial (estrellas/tenedores/categoría)
 *   2. Aforo
 *   3. Tipos de cocina (multi-select)
 *
 * No todos aplican a todos los recursos. Una playa no tiene estrellas ni
 * aforo ni cocina; un hotel tiene los tres; un restaurante tiene aforo y
 * cocina pero no estrellas; un museo solo tiene aforo.
 *
 * Este fichero centraliza esa lógica. La clave es el `main_type_key` de la
 * tipología principal (paso 1), que viene del catálogo UNE del paso 0 con
 * formato `tipo-de-recurso.<slug>`.
 *
 * REGLA DE ORO: ante la duda, OCULTAR el bloque. Un campo visible que no
 * aplica genera ruido en la UI y se exporta vacío al PID. Es preferible
 * dejarlo fuera y permitir añadirlo en iteraciones futuras.
 */

export interface EstablishmentFields {
  /** Mostrar el selector de estrellas/tenedores/categoría */
  showRating: boolean;
  /** Tipo de rating que aplica (determina las opciones del selector) */
  ratingKind: 'stars' | 'forks' | 'category' | null;
  /** Mostrar el campo numérico de aforo */
  showOccupancy: boolean;
  /** Mostrar el multi-select de tipos de cocina */
  showCuisine: boolean;
}

/** Configuración por tipo clave de recurso */
const TYPE_CONFIG: Record<string, EstablishmentFields> = {
  // ─── Alojamiento ─────────────────────────────────────────────────
  'tipo-de-recurso.hotel':             { showRating: true,  ratingKind: 'stars',    showOccupancy: true,  showCuisine: false },
  'tipo-de-recurso.alojamiento-rural': { showRating: true,  ratingKind: 'category', showOccupancy: true,  showCuisine: false },
  'tipo-de-recurso.camping':           { showRating: true,  ratingKind: 'category', showOccupancy: true,  showCuisine: false },

  // ─── Restauración ────────────────────────────────────────────────
  'tipo-de-recurso.restaurante':       { showRating: true,  ratingKind: 'forks',    showOccupancy: true,  showCuisine: true  },
  'tipo-de-recurso.bodega':            { showRating: false, ratingKind: null,       showOccupancy: true,  showCuisine: true  },

  // ─── Cultura ─────────────────────────────────────────────────────
  'tipo-de-recurso.museo':             { showRating: false, ratingKind: null,       showOccupancy: true,  showCuisine: false },
  'tipo-de-recurso.iglesia-capilla':   { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.pazo-arq-civil':    { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.yacimiento-ruina':  { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.molino':            { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },

  // ─── Naturaleza / espacio abierto ────────────────────────────────
  'tipo-de-recurso.playa':             { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.mirador':           { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.espacio-natural':   { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.paseo-maritimo':    { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.ruta':              { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
  'tipo-de-recurso.puerto-lonja':      { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },

  // ─── Eventos / inmateriales ──────────────────────────────────────
  'tipo-de-recurso.fiesta-festival':   { showRating: false, ratingKind: null,       showOccupancy: true,  showCuisine: false },
  'tipo-de-recurso.leyenda':           { showRating: false, ratingKind: null,       showOccupancy: false, showCuisine: false },
};

/** Valor por defecto cuando la tipología no está en el mapa (ocultar todo) */
const DEFAULT_CONFIG: EstablishmentFields = {
  showRating: false,
  ratingKind: null,
  showOccupancy: false,
  showCuisine: false,
};

/**
 * Devuelve qué campos específicos de establecimiento mostrar para una
 * tipología dada. Si la clave no está mapeada, oculta todo (comportamiento
 * seguro).
 */
export function getEstablishmentFields(mainTypeKey: string | null | undefined): EstablishmentFields {
  if (!mainTypeKey) return DEFAULT_CONFIG;
  return TYPE_CONFIG[mainTypeKey] ?? DEFAULT_CONFIG;
}

/**
 * Ayuda visual: ¿este tipo de recurso tiene ALGÚN campo de establecimiento?
 * Si no, el bloque entero "Datos del establecimiento" no se renderiza.
 */
export function hasAnyEstablishmentField(mainTypeKey: string | null | undefined): boolean {
  const f = getEstablishmentFields(mainTypeKey);
  return f.showRating || f.showOccupancy || f.showCuisine;
}

// ─── Opciones del selector de rating ─────────────────────────────────

export interface RatingOption {
  value: number;
  label: string;
  symbol: string;
}

/** Opciones para el selector según el tipo (stars/forks/category) */
export function getRatingOptions(kind: EstablishmentFields['ratingKind']): RatingOption[] {
  if (kind === 'stars') {
    return [
      { value: 1, label: '1 estrella',  symbol: '★☆☆☆☆' },
      { value: 2, label: '2 estrellas', symbol: '★★☆☆☆' },
      { value: 3, label: '3 estrellas', symbol: '★★★☆☆' },
      { value: 4, label: '4 estrellas', symbol: '★★★★☆' },
      { value: 5, label: '5 estrellas', symbol: '★★★★★' },
    ];
  }
  if (kind === 'forks') {
    return [
      { value: 1, label: '1 tenedor',  symbol: '🍴' },
      { value: 2, label: '2 tenedores', symbol: '🍴🍴' },
      { value: 3, label: '3 tenedores', symbol: '🍴🍴🍴' },
      { value: 4, label: '4 tenedores', symbol: '🍴🍴🍴🍴' },
      { value: 5, label: '5 tenedores', symbol: '🍴🍴🍴🍴🍴' },
    ];
  }
  if (kind === 'category') {
    return [
      { value: 1, label: 'Categoría básica',  symbol: 'Básica' },
      { value: 2, label: 'Categoría media',   symbol: 'Media' },
      { value: 3, label: 'Categoría superior', symbol: 'Superior' },
    ];
  }
  return [];
}

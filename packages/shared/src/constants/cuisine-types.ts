/**
 * Tipos de cocina segun UNE 178503 seccion 7.7 (atributo servesCuisine)
 */
export const CUISINE_TYPES = [
  'HAUTE CUISINE',
  'AFRICAN',
  'GERMAN',
  'ARGENTINIAN',
  'RICES',
  'BRAZILIAN',
  'HOME COOKING',
  'FAST FOOD',
  'CHINESE',
  'FRENCH',
  'GALICIAN',
  'GREEK',
  'INDIAN',
  'ITALIAN',
  'JAPANESE',
  'MEDITERRANEAN',
  'MEXICAN',
  'PERUVIAN',
  'SEAFOOD',
  'SPANISH',
  'TAPAS',
  'THAI',
  'VEGAN',
  'VEGETARIAN',
] as const;

export type CuisineType = typeof CUISINE_TYPES[number];

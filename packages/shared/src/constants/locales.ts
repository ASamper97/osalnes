/**
 * Idiomas soportados por la plataforma
 * Fuente: PLI-5 (multilingue), MEM-3.3
 */
export const LOCALES = {
  es: 'Espanol',
  gl: 'Galego',
  en: 'English',
  fr: 'Francais',
  pt: 'Portugues',
} as const;

export type Locale = keyof typeof LOCALES;

export const DEFAULT_LOCALE: Locale = 'es';

export const LOCALE_LIST = Object.keys(LOCALES) as Locale[];

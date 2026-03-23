import type { Locale } from './config.js';

/**
 * Static UI strings per locale.
 * Content (resource names, descriptions) comes from the API — these are only
 * for fixed UI labels, footer, nav, etc.
 */
const dictionaries: Record<Locale, () => Promise<Record<string, string>>> = {
  es: () => import('./dictionaries/es.json').then((m) => m.default),
  gl: () => import('./dictionaries/gl.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  fr: () => import('./dictionaries/fr.json').then((m) => m.default),
  pt: () => import('./dictionaries/pt.json').then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}

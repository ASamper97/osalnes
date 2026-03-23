export const locales = ['es', 'gl', 'en', 'fr', 'pt'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export const localeNames: Record<Locale, string> = {
  es: 'Castellano',
  gl: 'Galego',
  en: 'English',
  fr: 'Français',
  pt: 'Português',
};

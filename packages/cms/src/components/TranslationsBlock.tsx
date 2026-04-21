/**
 * TranslationsBlock — traducciones adicionales a EN/FR/PT
 *
 * Decisión 2-B: botón maestro "Traducir todo a EN/FR/PT" + botones
 * individuales por campo.
 *
 * Guarda en `ResourceSeo.translations`. El idioma base (ES, GL) ya se
 * rellenó en el paso 2; aquí solo van idiomas adicionales.
 */

import { useState } from 'react';
import {
  ADDITIONAL_LANGS,
  LANG_LABELS,
  type AdditionalLang,
  type TranslationByLang,
} from '@osalnes/shared/data/seo';
import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.translations;

export interface TranslationsBlockProps {
  /** Traducciones actuales */
  translations: Partial<Record<AdditionalLang, TranslationByLang>>;
  onChange: (next: Partial<Record<AdditionalLang, TranslationByLang>>) => void;

  /**
   * Callback para traducir un idioma concreto. Recibe el idioma destino;
   * el padre llama al edge function ai-writer.translate con
   * descriptionEs + resourceName como fuente.
   */
  onTranslateOne: (lang: AdditionalLang) => Promise<TranslationByLang | null>;

  /**
   * Callback para "Traducir todo": el padre traduce los 3 idiomas de golpe.
   * Devuelve un mapa con los que se han podido traducir.
   */
  onTranslateAll: () => Promise<Partial<Record<AdditionalLang, TranslationByLang>>>;

  /**
   * Si no hay descripción en el paso 2, los botones de IA se
   * deshabilitan (sin fuente que traducir).
   */
  hasSourceContent: boolean;
}

export default function TranslationsBlock({
  translations,
  onChange,
  onTranslateOne,
  onTranslateAll,
  hasSourceContent,
}: TranslationsBlockProps) {
  const [busyAll, setBusyAll] = useState(false);
  const [busyOne, setBusyOne] = useState<AdditionalLang | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateLang = (lang: AdditionalLang, patch: Partial<TranslationByLang>) => {
    const current = translations[lang] ?? { name: '', description: '' };
    onChange({ ...translations, [lang]: { ...current, ...patch } });
  };

  const handleTranslateAll = async () => {
    setError(null);
    setBusyAll(true);
    try {
      const result = await onTranslateAll();
      onChange({ ...translations, ...result });
    } catch {
      setError(COPY.translateErrorGeneric);
    } finally {
      setBusyAll(false);
    }
  };

  const handleTranslateOne = async (lang: AdditionalLang) => {
    setError(null);
    setBusyOne(lang);
    try {
      const result = await onTranslateOne(lang);
      if (result) {
        onChange({ ...translations, [lang]: result });
      }
    } catch {
      setError(COPY.translateErrorGeneric);
    } finally {
      setBusyOne(null);
    }
  };

  const langsLabel = ADDITIONAL_LANGS.map((l) => LANG_LABELS[l]).join(', ');

  return (
    <section className="translations-block">
      <header>
        <h4>{COPY.sectionTitle}</h4>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      {/* Botón maestro (decisión 2-B) */}
      <div className="translations-all-row">
        <button
          type="button"
          className="btn btn-ai-primary"
          onClick={handleTranslateAll}
          disabled={!hasSourceContent || busyAll}
          title={!hasSourceContent ? 'Añade una descripción en el paso 2 primero' : undefined}
        >
          {busyAll
            ? COPY.translateAllLoading
            : COPY.translateAllButton.replace('{langs}', langsLabel)}
        </button>
        <span className="muted translations-all-hint">{COPY.translateAllHint}</span>
      </div>

      {error && (
        <p role="alert" className="translations-error">
          ⚠️ {error}
        </p>
      )}

      {/* Grid por idioma */}
      <div className="translations-grid">
        {ADDITIONAL_LANGS.map((lang) => {
          const current = translations[lang] ?? { name: '', description: '' };
          const isBusy = busyOne === lang;
          const langLabel = LANG_LABELS[lang];

          return (
            <div key={lang} className="translation-lang">
              <div className="translation-lang-head">
                <h5>{langLabel}</h5>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handleTranslateOne(lang)}
                  disabled={!hasSourceContent || isBusy || busyAll}
                >
                  {isBusy ? COPY.translateOneLoading : `✨ ${COPY.translateOneButton}`}
                </button>
              </div>

              <label className="translation-field">
                <span className="translation-field-label">
                  {COPY.nameLabel.replace('{lang}', langLabel)}
                </span>
                <input
                  type="text"
                  value={current.name}
                  onChange={(e) => updateLang(lang, { name: e.target.value })}
                  placeholder={COPY.namePlaceholder}
                />
              </label>

              <label className="translation-field">
                <span className="translation-field-label">
                  {COPY.descLabel.replace('{lang}', langLabel)}
                </span>
                <textarea
                  value={current.description}
                  onChange={(e) => updateLang(lang, { description: e.target.value })}
                  placeholder={COPY.descPlaceholder}
                  rows={3}
                />
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}

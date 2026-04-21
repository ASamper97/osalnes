/**
 * SuggestTagsButton — botón + panel para sugerir etiquetas con IA
 *
 * Flujo:
 *   1. Usuario pulsa "Sugerir etiquetas".
 *   2. Llamamos al Edge Function `ai-writer` con action `suggestTags`,
 *      pasando descripción ES del paso 2 + tipología principal del paso 1.
 *   3. Edge Function devuelve array de sugerencias:
 *        { tagKey: 'caracteristicas.bandera-azul',
 *          reason: 'Mencionaste en la descripción que la playa tiene
 *                   certificación Q de calidad y bandera azul...' }
 *   4. Mostramos un panel con cada sugerencia y su explicación.
 *   5. Usuario marca/descarta una a una, o "Marcar todas".
 *
 * Decisión 4-A del usuario: modalidad "explicado" (la IA justifica cada
 * sugerencia con una frase corta). Más lento pero genera confianza.
 *
 * Este componente se encarga del botón, el estado y el panel. NO modifica
 * el estado del TagSelector directamente — delega en `onApplyTags` del
 * padre para que el padre controle qué hacer con los IDs sugeridos.
 */

import { useState } from 'react';
import { aiSuggestTags, type AiTagSuggestion } from '../lib/ai';
import { STEP4_COPY } from '../pages/step4-classification.copy';

export interface SuggestTagsButtonProps {
  /** Descripción ES del paso 2, la entrada principal de la IA */
  descriptionEs: string;
  /** Tipología principal del paso 1, para contextualizar la IA */
  mainTypeKey: string | null;
  /** Municipio del paso 1 (opcional, mejora contexto) */
  municipio?: string | null;
  /** Tags ya marcados por el usuario, para no proponerlos otra vez */
  currentTagKeys: string[];
  /** Callback para aplicar una o varias sugerencias al TagSelector */
  onApplyTags: (tagKeys: string[]) => void;
}

export default function SuggestTagsButton({
  descriptionEs,
  mainTypeKey,
  municipio,
  currentTagKeys,
  onApplyTags,
}: SuggestTagsButtonProps) {
  const COPY = STEP4_COPY.aiSuggest;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AiTagSuggestion[]>([]);
  /** IDs descartados en esta sesión (para no volver a mostrarlos) */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);

  const canSuggest = descriptionEs.trim().length > 20;

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    try {
      const results = await aiSuggestTags({
        descriptionEs,
        mainTypeKey,
        municipio: municipio ?? null,
        existingTagKeys: currentTagKeys,
      });
      setSuggestions(results);
      setDismissed(new Set());
      setPanelOpen(true);
    } catch {
      setError(COPY.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  function applyOne(tagKey: string) {
    onApplyTags([tagKey]);
    setDismissed((d) => new Set(d).add(tagKey));
  }

  function dismissOne(tagKey: string) {
    setDismissed((d) => new Set(d).add(tagKey));
  }

  function applyAll() {
    const keysToApply = suggestions
      .filter((s) => !dismissed.has(s.tagKey) && !currentTagKeys.includes(s.tagKey))
      .map((s) => s.tagKey);
    if (keysToApply.length > 0) {
      onApplyTags(keysToApply);
      setDismissed((d) => {
        const next = new Set(d);
        keysToApply.forEach((k) => next.add(k));
        return next;
      });
    }
  }

  function dismissAll() {
    setDismissed(new Set(suggestions.map((s) => s.tagKey)));
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.tagKey));

  return (
    <div className="suggest-tags">
      <div className="suggest-tags-intro">
        <div>
          <h4>{COPY.title}</h4>
          <p className="muted">{COPY.description}</p>
        </div>
        <button
          type="button"
          className="btn btn-ai-primary"
          onClick={handleSuggest}
          disabled={loading || !canSuggest}
          title={!canSuggest ? COPY.disabledHint : undefined}
        >
          ✨{' '}
          {loading
            ? COPY.buttonLoading
            : suggestions.length > 0
              ? COPY.buttonRetry
              : COPY.button}
        </button>
      </div>

      {!canSuggest && <p className="suggest-tags-disabled-hint muted">{COPY.disabledHint}</p>}

      {error && (
        <div role="alert" className="suggest-tags-error">
          ⚠️ {error}
        </div>
      )}

      {panelOpen && suggestions.length > 0 && (
        <div className="suggest-tags-panel" role="region" aria-label={COPY.suggestionsTitle}>
          <header className="suggest-tags-panel-head">
            <div>
              <h5>{COPY.suggestionsTitle}</h5>
              <p className="muted">{COPY.suggestionsSubtitle}</p>
            </div>
            <button
              type="button"
              className="suggest-tags-close"
              onClick={() => setPanelOpen(false)}
              aria-label={COPY.suggestedPanelClose}
            >
              ×
            </button>
          </header>

          {visibleSuggestions.length === 0 ? (
            <p className="suggest-tags-empty muted">{COPY.suggestedEmpty}</p>
          ) : (
            <>
              <ul className="suggest-tags-list" role="list">
                {visibleSuggestions.map((s) => (
                  <li key={s.tagKey} className="suggest-tag-item">
                    <div className="suggest-tag-body">
                      <strong className="suggest-tag-label">{s.labelEs}</strong>
                      <p className="suggest-tag-reason">{s.reason}</p>
                    </div>
                    <div className="suggest-tag-actions">
                      {currentTagKeys.includes(s.tagKey) ? (
                        <span className="suggest-tag-already">✓ {COPY.suggestedAlreadyMarked}</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => applyOne(s.tagKey)}
                          >
                            {COPY.suggestedApplyLabel}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => dismissOne(s.tagKey)}
                          >
                            {COPY.suggestedDismissLabel}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <footer className="suggest-tags-panel-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={dismissAll}>
                  {COPY.suggestedDismissAllLabel}
                </button>
                <button type="button" className="btn btn-ai-primary btn-sm" onClick={applyAll}>
                  {COPY.suggestedApplyAllLabel}
                </button>
              </footer>
            </>
          )}
        </div>
      )}
    </div>
  );
}

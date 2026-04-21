/**
 * KeywordsEditor — editor de palabras clave con chips y sugeridor IA
 *
 * Decisión 6-A: IA sugiere keywords leyendo la descripción del paso 2;
 * el usuario puede añadir manualmente también.
 *
 * Límites en SEO_LIMITS.keywords (max 12, ideal 3-8).
 */

import { useState, type KeyboardEvent } from 'react';
import { SEO_LIMITS } from '@osalnes/shared/data/seo';
import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.keywords;

export interface KeywordsEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Descripción ES del paso 2. Se pasa al sugeridor IA como entrada.
   * Si está vacía, el botón de sugerir está deshabilitado.
   */
  descriptionEs: string;

  /**
   * Callback al sugeridor IA. Devuelve array de keywords propuestas.
   * Gestionado por el padre (llama al edge function ai-writer.suggestKeywords).
   */
  onSuggestAi: (descriptionEs: string) => Promise<string[]>;
}

export default function KeywordsEditor({
  value,
  onChange,
  descriptionEs,
  onSuggestAi,
}: KeywordsEditorProps) {
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const atLimit = value.length >= SEO_LIMITS.keywords.hardMax;
  const canSuggest = descriptionEs.trim().length > 20 && !aiLoading;

  const addKeyword = (kw: string) => {
    const normalized = kw.trim().toLowerCase();
    if (!normalized) return;
    if (value.includes(normalized)) return;
    if (value.length >= SEO_LIMITS.keywords.hardMax) return;
    onChange([...value, normalized]);
  };

  const removeKeyword = (kw: string) => {
    onChange(value.filter((k) => k !== kw));
  };

  const handleAdd = () => {
    addKeyword(input);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      // Quita la última keyword con backspace en input vacío
      onChange(value.slice(0, -1));
    }
  };

  const handleAiSuggest = async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const suggestions = await onSuggestAi(descriptionEs);
      // Filtra las ya presentes
      const filtered = suggestions
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && !value.includes(s));
      setAiSuggestions(filtered);
    } catch {
      setAiError('No se han podido generar sugerencias.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAllSuggestions = () => {
    const room = SEO_LIMITS.keywords.hardMax - value.length;
    const toApply = aiSuggestions.slice(0, room);
    onChange([...value, ...toApply]);
    setAiSuggestions([]);
  };

  const applyOneSuggestion = (kw: string) => {
    addKeyword(kw);
    setAiSuggestions((curr) => curr.filter((s) => s !== kw));
  };

  return (
    <section className="keywords-editor">
      <header>
        <h4>{COPY.sectionTitle}</h4>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      {/* Chips actuales */}
      {value.length === 0 ? (
        <p className="keywords-empty muted">{COPY.emptyState}</p>
      ) : (
        <ul className="keywords-chips" role="list">
          {value.map((kw) => (
            <li key={kw} className="keyword-chip">
              <span>{kw}</span>
              <button
                type="button"
                onClick={() => removeKeyword(kw)}
                aria-label={`${COPY.removeLabel} ${kw}`}
                className="keyword-chip-remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Input + botón añadir */}
      {!atLimit && (
        <div className="keywords-add-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={COPY.addPlaceholder}
            className="keywords-input"
            aria-label={COPY.addPlaceholder}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleAdd}
            disabled={!input.trim()}
          >
            {COPY.addButton}
          </button>
        </div>
      )}

      {atLimit && (
        <p className="keywords-limit muted">
          {COPY.limitReached.replace('{max}', String(SEO_LIMITS.keywords.hardMax))}
        </p>
      )}

      {/* Botón IA */}
      <div className="keywords-ai">
        <button
          type="button"
          className="btn btn-ai-primary btn-sm"
          onClick={handleAiSuggest}
          disabled={!canSuggest}
          title={!canSuggest ? 'Añade primero una descripción en el paso 2' : undefined}
        >
          {aiLoading ? COPY.aiSuggestLoading : COPY.aiSuggestButton}
        </button>
        <span className="muted keywords-ai-hint">{COPY.aiSuggestHint}</span>
      </div>

      {aiError && (
        <p role="alert" className="keywords-error">
          ⚠️ {aiError}
        </p>
      )}

      {/* Panel de sugerencias */}
      {aiSuggestions.length > 0 && (
        <div className="keywords-suggestions">
          <div className="keywords-suggestions-head">
            <strong>Sugerencias de la IA</strong>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={applyAllSuggestions}
            >
              {COPY.applyAllSuggestions}
            </button>
          </div>
          <ul className="keywords-suggestions-list" role="list">
            {aiSuggestions.map((kw) => (
              <li key={kw} className="keyword-suggestion">
                <button
                  type="button"
                  onClick={() => applyOneSuggestion(kw)}
                  className="keyword-suggestion-chip"
                >
                  + {kw}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

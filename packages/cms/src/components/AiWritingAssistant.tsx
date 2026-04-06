import { useState } from 'react';
import { aiImprove, aiTranslate } from '@/lib/ai';

/**
 * AiWritingAssistant — Panel de sugerencias de escritura con IA
 * Se integra junto a los campos de texto en los wizards.
 */

interface AiWritingAssistantProps {
  /** Current text to work with */
  text: string;
  /** Language of the current text */
  lang: string;
  /** Callback when user accepts improved text */
  onAccept: (text: string) => void;
  /** All available translation targets */
  translationTargets?: { lang: string; label: string; onAccept: (text: string) => void }[];
}

export function AiWritingAssistant({ text, lang, onAccept, translationTargets = [] }: AiWritingAssistantProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultAction, setResultAction] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<{ lang: string; onAccept: (text: string) => void } | null>(null);

  async function handleImprove() {
    if (!text.trim()) return;
    setLoading('improve');
    setError(null);
    setResult(null);
    try {
      const improved = await aiImprove(text);
      setResult(improved);
      setResultAction('improve');
      setActiveTarget(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleTranslate(target: { lang: string; label: string; onAccept: (text: string) => void }) {
    if (!text.trim()) return;
    setLoading(`translate-${target.lang}`);
    setError(null);
    setResult(null);
    try {
      const translated = await aiTranslate(text, lang, target.lang);
      setResult(translated);
      setResultAction(`translate-${target.lang}`);
      setActiveTarget(target);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  function handleAccept() {
    if (!result) return;
    if (activeTarget) {
      activeTarget.onAccept(result);
    } else {
      onAccept(result);
    }
    setResult(null);
    setResultAction('');
    setActiveTarget(null);
  }

  function handleDiscard() {
    setResult(null);
    setResultAction('');
    setActiveTarget(null);
  }

  const hasText = text.trim().length > 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="ai-writer">
      {/* Action buttons */}
      <div className="ai-writer__actions">
        <span className="ai-writer__label">IA</span>

        <button
          type="button"
          className="ai-writer__btn"
          onClick={handleImprove}
          disabled={!hasText || !!loading}
          title="La IA mejora el texto haciendolo mas atractivo y profesional"
        >
          {loading === 'improve' ? '...' : '✨ Mejorar texto'}
        </button>

        {translationTargets.map((t) => (
          <button
            key={t.lang}
            type="button"
            className="ai-writer__btn ai-writer__btn--translate"
            onClick={() => handleTranslate(t)}
            disabled={!hasText || !!loading}
          >
            {loading === `translate-${t.lang}` ? '...' : `→ ${t.label}`}
          </button>
        ))}

        {wordCount > 0 && wordCount < 30 && (
          <span className="ai-writer__hint">Escribe al menos 30 palabras para mejores resultados de IA</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="ai-writer__error">
          {error}
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="ai-writer__result">
          <div className="ai-writer__result-header">
            <span className="ai-writer__result-badge">
              {resultAction === 'improve' ? '✨ Texto mejorado' : `🌐 Traduccion IA`}
            </span>
          </div>
          <div className="ai-writer__result-text">
            {result}
          </div>
          <div className="ai-writer__result-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleAccept}>
              Aplicar
            </button>
            <button type="button" className="btn btn-sm" onClick={handleDiscard}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

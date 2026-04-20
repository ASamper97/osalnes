/**
 * WordCountBadge — indicador de calidad de palabras
 *
 * Muestra cuántas palabras hay y en qué rango caen (Breve / Recomendada /
 * Extensa / Pendiente) con color semántico.
 *
 * En el paso 2 v2 se usa SOLO en el editor castellano. El editor gallego
 * muestra una línea de estado descriptiva (formatGlStatus) en su lugar.
 */

import { STEP2_COPY, computeWordCountState } from '../pages/step2-content.copy';

export interface WordCountBadgeProps {
  text: string;
  rangeHint?: string;
}

export default function WordCountBadge({
  text,
  rangeHint = STEP2_COPY.wordCount.rangeHint,
}: WordCountBadgeProps) {
  const { count, stateKey } = computeWordCountState(text);
  const state = STEP2_COPY.wordCount.states[stateKey];

  return (
    <div className={`word-count-badge word-count-badge--${state.tone}`}>
      <div className="word-count-badge-row">
        <span className="word-count-badge-count">{count}</span>
        <span className="word-count-badge-label-group">
          <span className="word-count-badge-label-value">{state.label}</span>
          <span className="word-count-badge-label-unit">
            {count === 1 ? 'palabra' : 'palabras'}
          </span>
        </span>
      </div>
      <p className="word-count-badge-hint">{rangeHint}</p>
    </div>
  );
}

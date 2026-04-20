/**
 * TranslationReadyToast — aviso no bloqueante que aparece en el paso 3+
 * cuando la traducción al gallego en background (disparada al pulsar
 * "Siguiente" en el paso 2) ha terminado.
 *
 * Ofrece dos acciones:
 *   - "Revisar ahora" → el padre navega al paso 2
 *   - "Cerrar" → descarta el toast (el trabajo ya está guardado)
 */

import { STEP2_COPY } from '../pages/step2-content.copy';

export interface TranslationReadyToastProps {
  visible: boolean;
  onReview: () => void;
  onDismiss: () => void;
}

export default function TranslationReadyToast({
  visible,
  onReview,
  onDismiss,
}: TranslationReadyToastProps) {
  if (!visible) return null;
  const copy = STEP2_COPY.translation.autoOnNextToast;

  return (
    <div className="translation-ready-toast" role="status" aria-live="polite">
      <div className="translation-ready-toast-icon" aria-hidden>
        ✨
      </div>
      <div className="translation-ready-toast-body">
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
      </div>
      <div className="translation-ready-toast-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onReview}>
          {copy.reviewLink}
        </button>
        <button
          type="button"
          className="translation-ready-toast-close"
          onClick={onDismiss}
          aria-label={copy.dismissLabel}
        >
          ×
        </button>
      </div>
    </div>
  );
}

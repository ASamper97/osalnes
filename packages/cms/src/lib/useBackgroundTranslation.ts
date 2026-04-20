/**
 * useBackgroundTranslation — hook para lanzar una traducción en background
 * al avanzar del paso 2 sin haber traducido el gallego manualmente.
 *
 * Vive en el ResourceWizardPage (el padre del paso 2). Expone:
 *
 *   - `isInFlight`            : boolean — flag a pasar al paso 2
 *   - `hasPendingReview`      : boolean — hay traducción lista para revisar
 *   - `dispatchIfNeeded()`    : lánzalo en el onClick de "Siguiente" del paso 2
 *   - `dismissReview()`       : cierra el toast sin tocar el gallego
 *
 * La traducción escribe el resultado en `descriptionGl` vía `setDescriptionGl`
 * y cambia `glStatus` a 'translated' cuando termina.
 */

import { useCallback, useRef, useState } from 'react';
import { aiTranslate } from '../lib/ai';
import type { GlStatus } from '../pages/step2-content.copy';

export interface UseBackgroundTranslationOptions {
  descriptionEs: string;
  descriptionGl: string;
  setDescriptionGl: (next: string) => void;
  setGlStatus: (next: GlStatus) => void;
}

export interface UseBackgroundTranslationReturn {
  isInFlight: boolean;
  hasPendingReview: boolean;
  lastError: string | null;
  dispatchIfNeeded: () => void;
  dismissReview: () => void;
}

export function useBackgroundTranslation({
  descriptionEs,
  descriptionGl,
  setDescriptionGl,
  setGlStatus,
}: UseBackgroundTranslationOptions): UseBackgroundTranslationReturn {
  const [isInFlight, setInFlight] = useState(false);
  const [hasPendingReview, setPendingReview] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const dispatchIfNeeded = useCallback(() => {
    // Condiciones:
    //   1. Hay ES para traducir.
    //   2. GL está vacío (no pisar trabajo del usuario).
    //   3. No hay otra traducción corriendo.
    if (!descriptionEs.trim()) return;
    if (descriptionGl.trim().length > 0) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setInFlight(true);
    setLastError(null);

    void aiTranslate({ text: descriptionEs, from: 'es', to: 'gl' })
      .then((gl) => {
        setDescriptionGl(gl);
        setGlStatus('translated');
        setPendingReview(true);
      })
      .catch((err: unknown) => {
        setLastError(err instanceof Error ? err.message : 'unknown');
        // Silencioso: no bloqueamos navegación ni mostramos error rojo.
        // El usuario puede volver al paso 2 y traducir manualmente.
      })
      .finally(() => {
        inFlightRef.current = false;
        setInFlight(false);
      });
  }, [descriptionEs, descriptionGl, setDescriptionGl, setGlStatus]);

  const dismissReview = useCallback(() => {
    setPendingReview(false);
  }, []);

  return {
    isInFlight,
    hasPendingReview,
    lastError,
    dispatchIfNeeded,
    dismissReview,
  };
}

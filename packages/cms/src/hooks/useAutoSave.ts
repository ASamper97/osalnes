/**
 * useAutoSave — hook para guardar automáticamente cada N segundos
 *
 * Filosofía:
 *   - No guarda inmediatamente en cada cambio (eso satura BD).
 *   - Guarda tras AUTOSAVE_INTERVAL segundos de inactividad (debounce).
 *   - Expone `status` ('idle' | 'saving' | 'saved' | 'error' | 'offline')
 *     para que la UI muestre indicador visual.
 *   - Detecta modo offline y guarda en localStorage como fallback
 *     (recuperable en próxima sesión).
 *   - Evita guardar si no ha habido cambios reales (compara hash simple).
 *
 * Uso:
 *
 *   const { status, lastSavedAt, forceSave } = useAutoSave({
 *     data: resourceState,
 *     enabled: resourceId != null,
 *     onSave: async (data) => {
 *       await supabase.from('resources').upsert({ id: resourceId, ...data });
 *     },
 *     intervalMs: 30_000,
 *     localStorageKey: `resource-autosave-${resourceId}`,
 *   });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

export interface UseAutoSaveOptions<T> {
  /** Datos a guardar. Se compara con el último guardado para detectar cambios. */
  data: T;
  /** Solo guardar cuando esto es true (útil para desactivar hasta tener ID). */
  enabled: boolean;
  /** Callback async que persiste los datos. Debe lanzar en error. */
  onSave: (data: T) => Promise<void>;
  /** Intervalo de debounce. Default: 30_000 (30 segundos). */
  intervalMs?: number;
  /** Clave de localStorage para fallback offline. Si no se pasa, no hay fallback. */
  localStorageKey?: string;
  /** Función opcional para serializar `data` al hash (default: JSON.stringify). */
  hashFn?: (d: T) => string;
}

export interface UseAutoSaveResult {
  /** Estado actual del auto-save */
  status: AutoSaveStatus;
  /** Última vez que se guardó con éxito (ISO string) */
  lastSavedAt: string | null;
  /** Mensaje de error si status='error' */
  errorMessage: string | null;
  /**
   * Forzar guardado inmediato (saltando el debounce). Útil para el botón
   * "Siguiente" al avanzar de paso.
   */
  forceSave: () => Promise<void>;
  /** ¿Hay cambios sin guardar? (dirty desde el último save exitoso) */
  isDirty: boolean;
}

const DEFAULT_INTERVAL = 30_000; // 30 segundos

export function useAutoSave<T>({
  data,
  enabled,
  onSave,
  intervalMs = DEFAULT_INTERVAL,
  localStorageKey,
  hashFn = (d: T) => JSON.stringify(d),
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Último hash guardado con éxito (para saber si hay cambios)
  const lastSavedHashRef = useRef<string>('');
  // Timer del debounce
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag de guardado en curso
  const savingRef = useRef(false);
  // Callback actualizado (evita stale closures)
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Detectar offline
  useEffect(() => {
    const handleOnline = () => {
      if (status === 'offline') {
        setStatus('idle');
        // Si hay datos en localStorage esperando, intentar sincronizar
        if (localStorageKey && isDirty) {
          void performSave();
        }
      }
    };
    const handleOffline = () => {
      setStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isDirty, localStorageKey]);

  const performSave = useCallback(async () => {
    if (savingRef.current) return;
    if (!enabled) return;

    const currentHash = hashFn(data);

    // Si no hay cambios reales desde el último save, no hacer nada
    if (currentHash === lastSavedHashRef.current) {
      setIsDirty(false);
      return;
    }

    // Si estamos offline, guardar en localStorage como fallback
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      if (localStorageKey) {
        try {
          localStorage.setItem(localStorageKey, JSON.stringify({
            data,
            savedAt: new Date().toISOString(),
          }));
        } catch {
          // localStorage lleno, ignora
        }
      }
      return;
    }

    savingRef.current = true;
    setStatus('saving');
    setErrorMessage(null);

    try {
      await onSaveRef.current(data);
      lastSavedHashRef.current = currentHash;
      setLastSavedAt(new Date().toISOString());
      setStatus('saved');
      setIsDirty(false);

      // Limpiar localStorage tras sync exitosa
      if (localStorageKey) {
        try {
          localStorage.removeItem(localStorageKey);
        } catch { /* ignora */ }
      }

      // Volver a 'idle' tras 3 segundos (el ✓ verde se queda visible)
      setTimeout(() => {
        setStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error al guardar');

      // Guardar en localStorage como fallback
      if (localStorageKey) {
        try {
          localStorage.setItem(localStorageKey, JSON.stringify({
            data,
            savedAt: new Date().toISOString(),
          }));
        } catch { /* ignora */ }
      }
    } finally {
      savingRef.current = false;
    }
  }, [data, enabled, hashFn, localStorageKey]);

  // Detectar cambios y programar guardado
  useEffect(() => {
    if (!enabled) return;

    const currentHash = hashFn(data);
    if (currentHash === lastSavedHashRef.current) {
      // Inicializar el hash en el primer render
      if (lastSavedHashRef.current === '') {
        lastSavedHashRef.current = currentHash;
      }
      return;
    }

    setIsDirty(true);

    // Reset del timer (debounce)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void performSave();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, enabled, intervalMs, hashFn, performSave]);

  // Cleanup: guardar al desmontar si hay cambios pendientes (ej. navegación)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // NO guardamos aquí porque `data` ya puede estar desmontándose.
      // El padre debe llamar a forceSave() explícitamente antes de navegar.
    };
  }, []);

  const forceSave = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await performSave();
  }, [performSave]);

  return {
    status,
    lastSavedAt,
    errorMessage,
    forceSave,
    isDirty,
  };
}

// ─── Helper: recuperar datos locales guardados en sesión previa ───────

/**
 * Comprueba si hay datos guardados en localStorage para esta key.
 * Devuelve el payload si existe, o null si no.
 *
 * El padre puede usar esto al montar el wizard para preguntar al usuario:
 * "¿Quieres recuperar cambios no guardados?"
 */
export function loadLocalAutosave<T>(
  key: string,
): { data: T; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; savedAt: string };
    if (!parsed.data || !parsed.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Limpia el autosave local (tras haber recuperado o descartado). */
export function clearLocalAutosave(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignora */ }
}

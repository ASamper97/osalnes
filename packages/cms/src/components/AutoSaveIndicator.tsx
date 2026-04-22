/**
 * AutoSaveIndicator — indicador visual del estado del autoguardado
 *
 * Pequeño pill en una esquina del wizard con:
 *   - ⏳ "Guardando..." (saving)
 *   - ✓ "Guardado" (saved) — fade out tras 3 s
 *   - ⚠ "Sin conexión" (offline)
 *   - ⚠ "Error al guardar" (error) — clicable para reintentar
 *   - (nada) si status='idle'
 *
 * Si hay `lastSavedAt`, muestra tooltip con "Guardado hace N min".
 */

import type { AutoSaveStatus } from '../hooks/useAutoSave';

export interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt: string | null;
  errorMessage?: string | null;
  /** Callback al pulsar el indicador de error para reintentar */
  onRetry?: () => void;
}

export default function AutoSaveIndicator({
  status,
  lastSavedAt,
  errorMessage,
  onRetry,
}: AutoSaveIndicatorProps) {
  if (status === 'idle' && !lastSavedAt) return null;

  const lastSavedText = lastSavedAt ? formatRelative(lastSavedAt) : null;

  return (
    <div
      className={`autosave-indicator autosave-indicator-${status}`}
      role="status"
      aria-live="polite"
    >
      {status === 'saving' && (
        <>
          <span className="autosave-spinner" aria-hidden>⏳</span>
          <span>Guardando…</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <span aria-hidden>✓</span>
          <span>Guardado</span>
          {lastSavedText && (
            <span className="autosave-relative muted">· {lastSavedText}</span>
          )}
        </>
      )}

      {status === 'idle' && lastSavedText && (
        <>
          <span aria-hidden>✓</span>
          <span className="muted">Guardado {lastSavedText}</span>
        </>
      )}

      {status === 'offline' && (
        <>
          <span aria-hidden>📡</span>
          <span>Sin conexión — cambios guardados localmente</span>
        </>
      )}

      {status === 'error' && (
        <button
          type="button"
          className="autosave-error-btn"
          onClick={onRetry}
          title={errorMessage ?? 'Error al guardar'}
        >
          <span aria-hidden>⚠</span>
          <span>Error al guardar — reintentar</span>
        </button>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 10) return 'ahora mismo';
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * ExportRetryDialog — modal de reintento
 *
 * Dos opciones radio (decisión 6-C):
 *   · Reintentar todo
 *   · Solo reintentar fallidos (deshabilitado si no hay fallidos)
 */

import { useEffect, useState } from 'react';
import type { RetryMode } from '@osalnes/shared/data/exports-detail';
import { EXPORTS_DETAIL_COPY, interpolateDetail } from '../../pages/exports-detail.copy';

const COPY = EXPORTS_DETAIL_COPY.retryDialog;

export interface ExportRetryDialogProps {
  totalRecords: number;
  failedRecords: number;
  creating: boolean;
  onConfirm: (mode: RetryMode) => Promise<void>;
  onClose: () => void;
}

export default function ExportRetryDialog({
  totalRecords,
  failedRecords,
  creating,
  onConfirm,
  onClose,
}: ExportRetryDialogProps) {
  const [mode, setMode] = useState<RetryMode>(failedRecords > 0 ? 'failed' : 'all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [creating, onClose]);

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm(mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el reintento');
    }
  };

  return (
    <div
      className="retry-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !creating) onClose(); }}
    >
      <div className="retry-dialog" role="dialog" aria-modal="true">
        <header>
          <h2>{COPY.title}</h2>
          <button
            type="button"
            className="retry-close"
            onClick={onClose}
            disabled={creating}
            aria-label="Cerrar"
          >×</button>
        </header>

        <div className="retry-body">
          <p className="retry-hint">{COPY.hint}</p>

          <div className="retry-options">
            <label className={`retry-option ${mode === 'all' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="retry-mode"
                value="all"
                checked={mode === 'all'}
                onChange={() => setMode('all')}
                disabled={creating}
              />
              <div className="retry-option-body">
                <div className="retry-option-label">{COPY.modeAllLabel}</div>
                <div className="retry-option-hint">
                  {interpolateDetail(COPY.modeAllHint, { total: totalRecords })}
                </div>
              </div>
            </label>

            <label className={`retry-option ${mode === 'failed' ? 'is-selected' : ''} ${failedRecords === 0 ? 'is-disabled' : ''}`}>
              <input
                type="radio"
                name="retry-mode"
                value="failed"
                checked={mode === 'failed'}
                onChange={() => setMode('failed')}
                disabled={creating || failedRecords === 0}
              />
              <div className="retry-option-body">
                <div className="retry-option-label">{COPY.modeFailedLabel}</div>
                <div className="retry-option-hint">
                  {failedRecords > 0
                    ? interpolateDetail(COPY.modeFailedHint, { failed: failedRecords })
                    : COPY.modeFailedDisabled}
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="retry-error" role="alert">⚠️ {error}</div>
          )}
        </div>

        <footer>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={creating}
          >{COPY.cancelButton}</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleConfirm()}
            disabled={creating}
          >
            {creating ? COPY.creating : '↻ ' + COPY.confirmButton}
          </button>
        </footer>
      </div>
    </div>
  );
}

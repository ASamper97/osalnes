/**
 * ExportJobDetailDrawer — panel lateral de detalle de un job (B1-A)
 *
 * Modal lateral (slide-in desde la derecha) con 4 tabs:
 *   · Resumen  (cabecera, métricas, breakdown de errores)
 *   · Payload  (selector de recurso + JSON formateado)
 *   · Errores  (lista agrupada por categoría con detalles colapsables)
 *   · Records  (tabla completa, filtrable por estado)
 *
 * Pie del drawer con:
 *   · Descarga payload bundle (JSON agregado · B2-C)
 *   · Descarga log sanitizado
 *   · Descarga log completo (solo admin · B3-C)
 *   · Reintentar job
 */

import { useEffect, useState } from 'react';
import type { UseExportJobDetailState } from '../../hooks/useExportJobDetail';
import {
  type DrawerTab,
  type RetryMode,
  DRAWER_TAB_LABELS,
} from '@osalnes/shared/data/exports-detail';
import {
  JOB_TYPE_LABELS,
  JOB_STATUS_LABELS,
  SCOPE_TYPE_LABELS,
  formatDuration,
} from '@osalnes/shared/data/exports';
import { EXPORTS_DETAIL_COPY } from '../../pages/exports-detail.copy';
import ExportRetryDialog from './ExportRetryDialog';
import ExportJobDetailSummary from './ExportJobDetailSummary';
import ExportJobDetailRecords from './ExportJobDetailRecords';
import ExportJobDetailErrors from './ExportJobDetailErrors';
import ExportJobDetailPayload from './ExportJobDetailPayload';

const COPY = EXPORTS_DETAIL_COPY;

export interface ExportJobDetailDrawerProps {
  state: UseExportJobDetailState;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
  /** Callback tras crear un reintento · la página lo usa para navegar al nuevo job */
  onRetryCreated?: (newJobId: string) => void;
  /** Abrir recurso desde el tab Errores o Records */
  onOpenResource?: (resourceId: string) => void;
}

export default function ExportJobDetailDrawer({
  state,
  isAdmin,
  isOpen,
  onClose,
  onRetryCreated,
  onOpenResource,
}: ExportJobDetailDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('summary');
  const [retryOpen, setRetryOpen] = useState(false);

  // Reset al cambiar de job
  useEffect(() => {
    setTab('summary');
    setRetryOpen(false);
  }, [state.detail?.id]);

  // Escape cierra el drawer
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !state.downloading && !state.retrying && !retryOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, state.downloading, state.retrying, retryOpen, onClose]);

  if (!isOpen) return null;

  const d = state.detail;
  const canRetry = d != null &&
    (d.status === 'success' || d.status === 'partial' || d.status === 'failed');
  const retryDisabledReason =
    d?.status === 'running' ? COPY.actions.retryDisabledRunning :
    d?.status === 'pending' ? COPY.actions.retryDisabledPending :
    null;

  const handleRetry = async (mode: RetryMode) => {
    const newJobId = await state.retry(mode);
    setRetryOpen(false);
    if (newJobId && onRetryCreated) onRetryCreated(newJobId);
  };

  return (
    <>
      <div
        className="drawer-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <aside
          className="drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de exportación"
        >
          {/* Cabecera */}
          <header className="drawer-header">
            {d ? (
              <>
                <div className="drawer-header-main">
                  <div className="drawer-header-type">
                    {JOB_TYPE_LABELS[d.jobType]}
                    {d.isRetry && (
                      <span className="drawer-retry-badge" title="Job generado como reintento">
                        {COPY.header.retryBadge}
                      </span>
                    )}
                  </div>
                  <div className={`drawer-header-status drawer-status-${d.status}`}>
                    {JOB_STATUS_LABELS[d.status]}
                  </div>
                </div>
                <div className="drawer-header-id">
                  {COPY.header.jobIdLabel}: <code>{d.id}</code>
                </div>
              </>
            ) : state.loading ? (
              <div className="drawer-header-loading">{COPY.drawer.loading}</div>
            ) : (
              <div className="drawer-header-loading">{COPY.drawer.notFound}</div>
            )}
            <button
              type="button"
              className="drawer-close"
              onClick={onClose}
              aria-label={COPY.drawer.closeAriaLabel}
            >×</button>
          </header>

          {/* Tabs */}
          {d && (
            <nav className="drawer-tabs" role="tablist">
              {(['summary', 'records', 'errors', 'payload'] as DrawerTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  className={`drawer-tab ${tab === t ? 'is-active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {DRAWER_TAB_LABELS[t]}
                  {t === 'errors' && d.recordsFailed > 0 && (
                    <span className="drawer-tab-counter">{d.recordsFailed}</span>
                  )}
                  {t === 'records' && d.recordsTotal > 0 && (
                    <span className="drawer-tab-counter-neutral">{d.recordsTotal}</span>
                  )}
                </button>
              ))}
            </nav>
          )}

          {/* Error global */}
          {state.error && (
            <div className="drawer-error-banner" role="alert">
              ⚠️ {state.error}
            </div>
          )}

          {/* Body scrollable */}
          <div className="drawer-body">
            {d && tab === 'summary' && (
              <ExportJobDetailSummary detail={d} />
            )}
            {d && tab === 'records' && (
              <ExportJobDetailRecords
                records={state.records}
                filter={state.recordsFilter}
                onFilterChange={state.setRecordsFilter}
                onOpenResource={onOpenResource}
              />
            )}
            {d && tab === 'errors' && (
              <ExportJobDetailErrors
                records={state.records.filter((r) => r.status === 'failed')}
                onOpenResource={onOpenResource}
              />
            )}
            {d && tab === 'payload' && (
              <ExportJobDetailPayload
                records={state.records.filter((r) => r.hasPayload)}
                onGetPayload={state.getRecordPayload}
              />
            )}
          </div>

          {/* Footer con acciones */}
          {d && (
            <footer className="drawer-footer">
              <div className="drawer-footer-downloads">
                <div className="drawer-footer-title">{COPY.actions.downloadTitle}</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void state.downloadPayloadBundle()}
                  disabled={state.downloading}
                  title={COPY.actions.downloadBundleHint}
                >
                  📦 {state.downloading ? COPY.actions.downloading : COPY.actions.downloadBundle}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void state.downloadLog('sanitized')}
                  disabled={state.downloading}
                  title={COPY.actions.downloadLogSanitizedHint}
                >
                  📄 {state.downloading ? COPY.actions.downloading : COPY.actions.downloadLogSanitized}
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm drawer-footer-admin-btn"
                    onClick={() => void state.downloadLog('full')}
                    disabled={state.downloading}
                    title={COPY.actions.downloadLogFullHint}
                  >
                    🔓 {state.downloading ? COPY.actions.downloading : COPY.actions.downloadLogFull}
                  </button>
                )}
              </div>

              <div className="drawer-footer-retry">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setRetryOpen(true)}
                  disabled={!canRetry || state.retrying}
                  title={retryDisabledReason ?? undefined}
                >
                  {state.retrying ? '…' : COPY.actions.retryButton}
                </button>
              </div>
            </footer>
          )}
        </aside>
      </div>

      {retryOpen && d && (
        <ExportRetryDialog
          totalRecords={d.recordsTotal}
          failedRecords={d.recordsFailed}
          creating={state.retrying}
          onConfirm={handleRetry}
          onClose={() => setRetryOpen(false)}
        />
      )}
    </>
  );
}

// Helpers formato ligero (reexport local para keep imports tidy)
export { JOB_TYPE_LABELS, JOB_STATUS_LABELS, SCOPE_TYPE_LABELS, formatDuration };

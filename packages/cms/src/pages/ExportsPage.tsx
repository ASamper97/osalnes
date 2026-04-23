/**
 * ExportsPage — página SCR-13 Centro de exportaciones (fase A)
 *
 * Compone: cabecera + KPIs + filtros + tabla + lanzador.
 * El drawer de detalle y reintento se añaden en la fase B.
 */

import { useState } from 'react';
import type { UseExportsState } from '../hooks/useExports';
import ExportsKpisBar from '../components/exports/ExportsKpisBar';
import ExportsFiltersPanel from '../components/exports/ExportsFiltersPanel';
import ExportsTable from '../components/exports/ExportsTable';
import ExportLauncherDialog from '../components/exports/ExportLauncherDialog';
import { EMPTY_FILTERS } from '../hooks/useExports';
import { EXPORTS_COPY } from './exports.copy';

const COPY = EXPORTS_COPY.header;

export interface ExportsPageProps {
  state: UseExportsState;

  /** Si se abre el launcher desde el listado del CMS, pasa los filtros/ids actuales */
  prefilledFilters?: Record<string, unknown> | null;
  prefilledSelection?: string[] | null;

  /** Callback cuando el usuario pulsa "Ver detalle" (el drawer es de fase B) */
  onOpenJobDetail: (jobId: string) => void;
}

export default function ExportsPage({
  state,
  prefilledFilters = null,
  prefilledSelection = null,
  onOpenJobDetail,
}: ExportsPageProps) {
  const [launcherOpen, setLauncherOpen] = useState(false);

  return (
    <div className="exports-page">
      <header className="exports-page-header">
        <div>
          <h1>{COPY.title}</h1>
          <p className="muted">{COPY.subtitle}</p>
        </div>
        <div className="exports-page-header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void state.refetch()}
            disabled={state.loading}
          >
            {state.loading ? '⏳' : '↻'} {COPY.refreshButton}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setLauncherOpen(true)}
          >
            {COPY.launchButton}
          </button>
        </div>
      </header>

      {/* Error global */}
      {state.error && (
        <div className="exports-global-error" role="alert">
          ⚠️ {state.error}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void state.refetch()}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* KPIs */}
      <ExportsKpisBar kpis={state.kpis} loading={state.initialLoading} />

      {/* Filtros */}
      <ExportsFiltersPanel
        filters={state.filters}
        onChange={state.setFilters}
        onClear={() => state.setFilters(EMPTY_FILTERS)}
      />

      {/* Tabla */}
      <ExportsTable
        rows={state.rows}
        loading={state.initialLoading}
        onOpenDetail={onOpenJobDetail}
      />

      {/* Paginación básica */}
      {state.totalCount > state.pageSize && (
        <div className="exports-pagination">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => state.setPage(Math.max(1, state.page - 1))}
            disabled={state.page <= 1 || state.loading}
          >
            ← Anterior
          </button>
          <span className="muted">
            Página {state.page} de {Math.ceil(state.totalCount / state.pageSize)}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => state.setPage(state.page + 1)}
            disabled={state.page >= Math.ceil(state.totalCount / state.pageSize) || state.loading}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Diálogo "Nueva exportación" */}
      {launcherOpen && (
        <ExportLauncherDialog
          prefilledFilters={prefilledFilters}
          prefilledSelection={prefilledSelection}
          onValidate={state.validateScope}
          onLaunch={state.launch}
          onClose={() => setLauncherOpen(false)}
        />
      )}
    </div>
  );
}

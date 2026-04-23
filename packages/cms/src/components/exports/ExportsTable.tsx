/**
 * ExportsTable — tabla técnica con los jobs de exportación
 *
 * Columnas (pliego):
 *   Tipo · Estado · Alcance · Recursos · Inicio · Duración · Lanzado por · Acciones
 *
 * La columna "Estado" usa badges de color. Los jobs running muestran
 * una barra de progreso inline.
 */

import type { ExportJobRow } from '@osalnes/shared/data/exports';
import {
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  JOB_TYPE_ICONS,
  SCOPE_TYPE_LABELS,
  computeProgress,
  formatDuration,
} from '@osalnes/shared/data/exports';
import { EXPORTS_COPY } from '../../pages/exports.copy';

const COPY = EXPORTS_COPY.table;

export interface ExportsTableProps {
  rows: ExportJobRow[];
  loading: boolean;
  onOpenDetail: (jobId: string) => void;
}

export default function ExportsTable({
  rows,
  loading,
  onOpenDetail,
}: ExportsTableProps) {
  if (loading && rows.length === 0) {
    return (
      <div className="exports-table-wrap">
        <div className="exports-table-skeleton">
          <div className="exports-skeleton-row" />
          <div className="exports-skeleton-row" />
          <div className="exports-skeleton-row" />
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="exports-table-empty">
        <strong>{COPY.emptyTitle}</strong>
        <p className="muted">{COPY.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="exports-table-wrap">
      <table className="exports-table">
        <thead>
          <tr>
            <th>{COPY.columns.type}</th>
            <th>{COPY.columns.status}</th>
            <th>{COPY.columns.scope}</th>
            <th>{COPY.columns.records}</th>
            <th>{COPY.columns.started}</th>
            <th>{COPY.columns.duration}</th>
            <th>{COPY.columns.triggeredBy}</th>
            <th className="exports-table-actions-col">{COPY.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.id} row={row} onOpenDetail={onOpenDetail} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RowProps {
  row: ExportJobRow;
  onOpenDetail: (id: string) => void;
}

function Row({ row, onOpenDetail }: RowProps) {
  const isRunning = row.status === 'running';
  const progress = computeProgress(row);

  return (
    <tr
      className={`exports-table-row exports-row-${row.status}`}
      onClick={() => onOpenDetail(row.id)}
    >
      <td>
        <div className="exports-cell-type">
          <span className="exports-cell-type-icon" aria-hidden>{JOB_TYPE_ICONS[row.jobType]}</span>
          <span className="exports-cell-type-label">{JOB_TYPE_LABELS[row.jobType]}</span>
          {row.isRetry && (
            <span className="exports-retry-badge" title="Este job es un reintento">
              ↻ {COPY.retryBadge}
            </span>
          )}
        </div>
      </td>

      <td>
        <StatusBadge status={row.status} />
        {isRunning && (
          <div className="exports-progress" aria-label={`Progreso ${progress}%`}>
            <div className="exports-progress-bar" style={{ width: `${progress}%` }} />
            <span className="exports-progress-label">{progress}%</span>
          </div>
        )}
      </td>

      <td className="muted">{SCOPE_TYPE_LABELS[row.scopeType]}</td>

      <td>
        <RecordsCell row={row} />
      </td>

      <td className="exports-cell-when">
        {formatDateTime(row.startedAt)}
      </td>

      <td className="exports-cell-duration">
        {formatDuration(row.durationMs)}
      </td>

      <td className="exports-cell-user">
        {row.triggeredByEmail ? shortenEmail(row.triggeredByEmail) : '—'}
      </td>

      <td className="exports-table-actions-col">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(row.id);
          }}
        >
          {COPY.viewDetailButton} →
        </button>
      </td>
    </tr>
  );
}

// ─── Badge de estado ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: ExportJobRow['status'] }) {
  const label = JOB_STATUS_LABELS[status];
  return (
    <span className={`exports-status-badge exports-status-${status}`}>
      {status === 'pending' && '○ '}
      {status === 'running' && '◐ '}
      {status === 'success' && '✓ '}
      {status === 'partial' && '⚠ '}
      {status === 'failed' && '✗ '}
      {label}
    </span>
  );
}

// ─── Cell de recursos: "15/15" o "12 OK · 3 error" ────────────────────

function RecordsCell({ row }: { row: ExportJobRow }) {
  if (row.status === 'pending') {
    return <span className="muted">{row.recordsTotal}</span>;
  }
  if (row.status === 'running') {
    return (
      <span className="exports-cell-records">
        {row.recordsProcessed + row.recordsFailed} / {row.recordsTotal}
      </span>
    );
  }
  if (row.status === 'partial' || row.status === 'failed') {
    return (
      <span className="exports-cell-records">
        <span className="exports-cell-ok">{row.recordsProcessed} OK</span>
        <span className="muted"> · </span>
        <span className="exports-cell-err">{row.recordsFailed} error{row.recordsFailed === 1 ? '' : 'es'}</span>
      </span>
    );
  }
  return <span>{row.recordsProcessed} / {row.recordsTotal}</span>;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortenEmail(email: string): string {
  const [local] = email.split('@');
  if (!local) return email;
  return local.length <= 14 ? local : `${local.slice(0, 12)}…`;
}

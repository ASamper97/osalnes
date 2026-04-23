/**
 * ExportJobDetailSummary — tab "Resumen" del drawer
 */

import type { ExportJobDetail } from '@osalnes/shared/data/exports-detail';
import {
  ERROR_CATEGORY_LABELS,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  SCOPE_TYPE_LABELS,
  formatDuration,
  type ExportErrorCategory,
} from '@osalnes/shared/data/exports';
import { EXPORTS_DETAIL_COPY } from '../../pages/exports-detail.copy';

const COPY = EXPORTS_DETAIL_COPY.summary;

export interface ExportJobDetailSummaryProps {
  detail: ExportJobDetail;
}

export default function ExportJobDetailSummary({ detail: d }: ExportJobDetailSummaryProps) {
  const errorEntries = Object.entries(d.errorSummary).filter(
    ([, v]) => typeof v === 'number' && v > 0,
  ) as [ExportErrorCategory, number][];

  return (
    <div className="drawer-summary">
      <dl className="drawer-summary-grid">
        <div>
          <dt>{COPY.typeLabel}</dt>
          <dd>{JOB_TYPE_LABELS[d.jobType]}</dd>
        </div>
        <div>
          <dt>{COPY.statusLabel}</dt>
          <dd className={`drawer-summary-status drawer-summary-status-${d.status}`}>
            {JOB_STATUS_LABELS[d.status]}
          </dd>
        </div>
        <div>
          <dt>{COPY.scopeLabel}</dt>
          <dd>{SCOPE_TYPE_LABELS[d.scopeType]}</dd>
        </div>
        <div>
          <dt>{COPY.startedLabel}</dt>
          <dd>{formatFullDateTime(d.startedAt)}</dd>
        </div>
        <div>
          <dt>{COPY.finishedLabel}</dt>
          <dd>{d.finishedAt ? formatFullDateTime(d.finishedAt) : '—'}</dd>
        </div>
        <div>
          <dt>{COPY.durationLabel}</dt>
          <dd>{formatDuration(d.durationMs)}</dd>
        </div>
        <div>
          <dt>{COPY.triggeredByLabel}</dt>
          <dd>{d.triggeredByEmail ?? '—'}</dd>
        </div>
        <div>
          <dt>{COPY.totalLabel}</dt>
          <dd className="drawer-summary-number">{d.recordsTotal}</dd>
        </div>
        <div>
          <dt>{COPY.okLabel}</dt>
          <dd className="drawer-summary-number drawer-summary-ok">{d.recordsProcessed}</dd>
        </div>
        <div>
          <dt>{COPY.failedLabel}</dt>
          <dd className="drawer-summary-number drawer-summary-err">{d.recordsFailed}</dd>
        </div>
        {d.recordsSkipped > 0 && (
          <div>
            <dt>{COPY.skippedLabel}</dt>
            <dd className="drawer-summary-number drawer-summary-warn">{d.recordsSkipped}</dd>
          </div>
        )}
      </dl>

      {d.notes && (
        <div className="drawer-summary-notes">
          <dt>{COPY.notesLabel}</dt>
          <dd>{d.notes}</dd>
        </div>
      )}

      {errorEntries.length > 0 && (
        <div className="drawer-summary-breakdown">
          <h3>{COPY.errorBreakdownTitle}</h3>
          <ul>
            {errorEntries.map(([cat, count]) => (
              <li key={cat}>
                <span className={`drawer-err-chip drawer-err-chip-${cat}`}>
                  {ERROR_CATEGORY_LABELS[cat]}
                </span>
                <span className="drawer-err-count">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatFullDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

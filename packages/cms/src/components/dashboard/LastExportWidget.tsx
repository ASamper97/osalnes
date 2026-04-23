/**
 * LastExportWidget — estado de la última exportación PID
 */

import type { DashboardOverview } from '@osalnes/shared/data/dashboard';
import { formatRelativePast } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.lastExport;

export interface LastExportWidgetProps {
  overview: DashboardOverview;
  onNavigate: (href: string) => void;
}

export default function LastExportWidget({ overview, onNavigate }: LastExportWidgetProps) {
  if (!overview.lastExportAt) {
    return (
      <section className="dashboard-widget dashboard-widget-last-export">
        <h2 className="dashboard-widget-title">{COPY.title}</h2>
        <div className="dashboard-widget-empty">
          <p className="muted">{COPY.none}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigate(overview.lastExportId ? `/exports/${overview.lastExportId}` : '/exports')}
          >
            📤 Lanzar exportación →
          </button>
        </div>
      </section>
    );
  }

  const status = overview.lastExportStatus ?? 'success';
  const statusVariant =
    status === 'success' ? 'success' :
    status === 'failed' ? 'failed' :
    status === 'partial' ? 'partial' :
    status === 'running' ? 'running' : 'success';

  const statusLabel =
    status === 'success' ? COPY.successLabel :
    status === 'failed' ? COPY.failedLabel :
    status === 'partial' ? COPY.partialLabel :
    status === 'running' ? COPY.runningLabel : COPY.successLabel;

  const icon =
    status === 'success' ? '✓' :
    status === 'failed' ? '✗' :
    status === 'partial' ? '⚠' :
    status === 'running' ? '⏳' : '✓';

  return (
    <section className="dashboard-widget dashboard-widget-last-export">
      <h2 className="dashboard-widget-title">{COPY.title}</h2>
      <div className={`last-export-card last-export-${statusVariant}`}>
        <div className="last-export-icon" aria-hidden>{icon}</div>
        <div className="last-export-body">
          <div className="last-export-status">{statusLabel}</div>
          <div className="last-export-when muted">
            {formatRelativePast(overview.lastExportAt)}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onNavigate('/exports')}
        >
          {COPY.viewHistoryLabel} →
        </button>
      </div>
    </section>
  );
}

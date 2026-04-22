/**
 * UpcomingScheduledWidget — próximas publicaciones programadas (decisión 5-A)
 */

import type { ScheduledRow } from '@osalnes/shared/data/dashboard';
import { formatScheduledLabel } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.upcomingScheduled;

export interface UpcomingScheduledWidgetProps {
  rows: ScheduledRow[];
  loading: boolean;
  onOpenResource: (id: string) => void;
  onCancelSchedule: (id: string) => Promise<void>;
  onNavigate: (href: string) => void;
  resolveTypologyLabel: (key: string | null) => string;
}

export default function UpcomingScheduledWidget({
  rows,
  loading,
  onOpenResource,
  onCancelSchedule,
  onNavigate,
  resolveTypologyLabel,
}: UpcomingScheduledWidgetProps) {
  return (
    <section className="dashboard-widget dashboard-widget-upcoming">
      <header className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-widget-title">{COPY.title}</h2>
          <p className="dashboard-widget-subtitle">{COPY.subtitle}</p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            className="dashboard-widget-link"
            onClick={() => onNavigate('/resources?status=scheduled')}
          >
            {COPY.viewAllLabel} →
          </button>
        )}
      </header>

      {loading && rows.length === 0 ? (
        <div className="dashboard-widget-loading">
          <div className="dashboard-skeleton-row"><div className="dashboard-skeleton-bar" style={{ width: '55%' }} /></div>
          <div className="dashboard-skeleton-row"><div className="dashboard-skeleton-bar" style={{ width: '40%' }} /></div>
        </div>
      ) : rows.length === 0 ? (
        <div className="dashboard-widget-empty">
          <strong>{COPY.emptyTitle}</strong>
          <p className="muted">{COPY.emptyHint}</p>
        </div>
      ) : (
        <ul className="upcoming-list" role="list">
          {rows.map((row) => (
            <ScheduledRowItem
              key={row.id}
              row={row}
              onOpen={() => onOpenResource(row.id)}
              onCancel={() => onCancelSchedule(row.id)}
              resolveTypologyLabel={resolveTypologyLabel}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ScheduledRowItem({
  row,
  onOpen,
  onCancel,
  resolveTypologyLabel,
}: {
  row: ScheduledRow;
  onOpen: () => void;
  onCancel: () => Promise<void>;
  resolveTypologyLabel: (key: string | null) => string;
}) {
  const whenLabel = formatScheduledLabel(row.scheduledPublishAt);
  const isSoon =
    new Date(row.scheduledPublishAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <li className="upcoming-item">
      <div className="upcoming-item-when">
        <span
          className={`upcoming-item-when-chip ${isSoon ? 'is-soon' : ''}`}
          aria-label={`Publicación ${whenLabel}`}
        >
          📅 {whenLabel}
        </span>
      </div>
      <div className="upcoming-item-body">
        <button
          type="button"
          className="upcoming-item-name"
          onClick={onOpen}
        >
          {row.nameEs || row.nameGl || '(sin nombre)'}
        </button>
        <div className="upcoming-item-meta">
          <span>{resolveTypologyLabel(row.singleTypeVocabulary)}</span>
          {row.municipalityName && (
            <>
              <span className="muted">·</span>
              <span>{row.municipalityName}</span>
            </>
          )}
          {row.pidMissingRequired > 0 && (
            <>
              <span className="muted">·</span>
              <span className="upcoming-item-warning">
                ⚠ Faltan {row.pidMissingRequired} obligatorio{row.pidMissingRequired === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="upcoming-item-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onOpen}
        >
          {DASHBOARD_COPY.upcomingScheduled.editLabel}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm upcoming-item-cancel"
          onClick={() => void onCancel()}
          title={COPY.cancelScheduleLabel}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

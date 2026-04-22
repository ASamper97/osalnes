/**
 * MyWorkWidget — borradores del usuario actual (decisión 1-C)
 */

import type { MyWorkRow } from '@osalnes/shared/data/dashboard';
import { formatRelativePast } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.myWork;

export interface MyWorkWidgetProps {
  rows: MyWorkRow[];
  loading: boolean;
  onOpenResource: (id: string) => void;
  onNavigate: (href: string) => void;
  resolveTypologyLabel: (key: string | null) => string;
}

export default function MyWorkWidget({
  rows,
  loading,
  onOpenResource,
  onNavigate,
  resolveTypologyLabel,
}: MyWorkWidgetProps) {
  return (
    <section className="dashboard-widget dashboard-widget-my-work">
      <header className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-widget-title">{COPY.title}</h2>
          <p className="dashboard-widget-subtitle">{COPY.subtitle}</p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            className="dashboard-widget-link"
            onClick={() => onNavigate('/resources?status=draft&mine=1')}
          >
            {COPY.viewAllLabel} →
          </button>
        )}
      </header>

      {loading && rows.length === 0 ? (
        <div className="dashboard-widget-loading">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : rows.length === 0 ? (
        <div className="dashboard-widget-empty">
          <strong>{COPY.emptyTitle}</strong>
          <p className="muted">{COPY.emptyHint}</p>
        </div>
      ) : (
        <ul className="my-work-list" role="list">
          {rows.map((row) => (
            <li key={row.id} className="my-work-item">
              <button
                type="button"
                className="my-work-item-body"
                onClick={() => onOpenResource(row.id)}
                aria-label={`Continuar edición de ${row.nameEs}`}
              >
                <div className="my-work-item-main">
                  <div className="my-work-item-name">{row.nameEs || row.nameGl || '(sin nombre)'}</div>
                  <div className="my-work-item-meta">
                    <span className="my-work-item-typology">
                      {resolveTypologyLabel(row.singleTypeVocabulary)}
                    </span>
                    <span className="muted">·</span>
                    <span className="my-work-item-updated">
                      {formatRelativePast(row.updatedAt)}
                    </span>
                    {row.pidMissingRequired > 0 && (
                      <>
                        <span className="muted">·</span>
                        <span className="my-work-item-warning">
                          {row.pidMissingRequired} obligatorio{row.pidMissingRequired === 1 ? '' : 's'} sin rellenar
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="my-work-item-score">
                  <QualityBadgeSmall score={row.qualityScore} />
                </div>
                <span className="my-work-item-continue">{COPY.continueLabel} →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QualityBadgeSmall({ score }: { score: number }) {
  const band = score < 50 ? 'low' : score < 80 ? 'mid' : 'high';
  return (
    <span className={`quality-badge-small quality-badge-small-${band}`} title={`Calidad ${score}/100`}>
      {score}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="dashboard-skeleton-row">
      <div className="dashboard-skeleton-bar" style={{ width: '60%' }} />
      <div className="dashboard-skeleton-bar" style={{ width: '35%' }} />
    </div>
  );
}

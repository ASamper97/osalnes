/**
 * DataQualityWidget — 3 barras de completitud (descripción, imágenes, coords)
 *
 * Calculado desde overview (ya tiene los counts negativos).
 * Cada barra muestra "X de Y completos" y permite clic para filtrar.
 */

import type { DashboardOverview } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.dataQuality;

export interface DataQualityWidgetProps {
  overview: DashboardOverview;
  loading: boolean;
  onNavigate: (href: string) => void;
}

export default function DataQualityWidget({
  overview,
  loading,
  onNavigate,
}: DataQualityWidgetProps) {
  const total = overview.total;
  const withDescription = total - overview.withoutDescriptionEs;
  const withImages = total - overview.withoutImage;
  const withCoords = total - overview.withoutCoordinates;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const bars = [
    {
      id: 'description',
      label: COPY.withDescription,
      complete: withDescription,
      total,
      percent: pct(withDescription),
      missing: overview.withoutDescriptionEs,
      clickable: overview.withoutDescriptionEs > 0,
      href: '/resources',
    },
    {
      id: 'images',
      label: COPY.withImages,
      complete: withImages,
      total,
      percent: pct(withImages),
      missing: overview.withoutImage,
      clickable: overview.withoutImage > 0,
      href: '/resources',
    },
    {
      id: 'coords',
      label: COPY.withCoordinates,
      complete: withCoords,
      total,
      percent: pct(withCoords),
      missing: overview.withoutCoordinates,
      clickable: overview.withoutCoordinates > 0,
      href: '/resources?coords=0',
    },
  ];

  return (
    <section className="dashboard-widget dashboard-widget-data-quality">
      <h2 className="dashboard-widget-title">{COPY.title}</h2>
      {loading && total === 0 ? (
        <div className="dashboard-widget-loading">
          {bars.map((b) => (
            <div key={b.id} className="dashboard-skeleton-row">
              <div className="dashboard-skeleton-bar" style={{ width: '100%' }} />
            </div>
          ))}
        </div>
      ) : (
        <ul className="data-quality-list" role="list">
          {bars.map((bar) => (
            <li key={bar.id} className="data-quality-item">
              <button
                type="button"
                className="data-quality-item-body"
                onClick={() => bar.clickable && onNavigate(bar.href)}
                disabled={!bar.clickable}
              >
                <div className="data-quality-item-header">
                  <span className="data-quality-item-label">{bar.label}</span>
                  <span className="data-quality-item-count">
                    {bar.complete} / {bar.total}
                    <span className="data-quality-item-percent">{bar.percent}%</span>
                  </span>
                </div>
                <div className="data-quality-item-bar" aria-hidden>
                  <div
                    className={`data-quality-item-bar-fill data-quality-item-bar-${bandForPercent(bar.percent)}`}
                    style={{ width: `${bar.percent}%` }}
                  />
                </div>
                {bar.clickable && (
                  <div className="data-quality-item-cta">
                    Ver {bar.missing} pendiente{bar.missing === 1 ? '' : 's'} →
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function bandForPercent(p: number): 'low' | 'mid' | 'high' {
  if (p < 40) return 'low';
  if (p < 80) return 'mid';
  return 'high';
}

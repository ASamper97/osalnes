/**
 * UneIndicatorsWidget — 6 cards con indicadores UNE 178502
 *
 * Los 5 del dashboard actual + Interoperabilidad PID. Cada card muestra:
 *   - Letra A/B/C/D grande (calificación)
 *   - Porcentaje
 *   - Label y descripción breve
 *   - Color según tramo
 *
 * Es el "diferenciador de cara al cliente": demuestra alineamiento
 * con la norma sin presentar complejidad de BI.
 */

import type { UneIndicator, UneIndicators } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.uneIndicators;

export interface UneIndicatorsWidgetProps {
  indicators: UneIndicators;
  loading: boolean;
}

export default function UneIndicatorsWidget({ indicators, loading }: UneIndicatorsWidgetProps) {
  return (
    <section className="dashboard-widget dashboard-widget-une">
      <header className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-widget-title">{COPY.title}</h2>
          <p className="dashboard-widget-subtitle">{COPY.subtitle}</p>
        </div>
      </header>

      <div className="une-grid">
        <UneCard
          label={COPY.digitalization.label}
          description={COPY.digitalization.description}
          indicator={indicators.digitalization}
          loading={loading}
        />
        <UneCard
          label={COPY.multilingualism.label}
          description={COPY.multilingualism.description}
          indicator={indicators.multilingualism}
          loading={loading}
        />
        <UneCard
          label={COPY.georeferencing.label}
          description={COPY.georeferencing.description}
          indicator={indicators.georeferencing}
          loading={loading}
        />
        <UneCard
          label={COPY.freshness30d.label}
          description={COPY.freshness30d.description}
          indicator={indicators.freshness30d}
          loading={loading}
        />
        <UneCard
          label={COPY.freshness90d.label}
          description={COPY.freshness90d.description}
          indicator={indicators.freshness90d}
          loading={loading}
        />
        <UneCard
          label={COPY.pidInterop.label}
          description={COPY.pidInterop.description}
          indicator={indicators.pidInterop}
          loading={loading}
        />
      </div>
    </section>
  );
}

function UneCard({
  label,
  description,
  indicator,
  loading,
}: {
  label: string;
  description: string;
  indicator: UneIndicator;
  loading: boolean;
}) {
  return (
    <article className={`une-card une-card-${indicator.band.toLowerCase()}`}>
      <div className="une-card-badge" aria-hidden>
        {loading ? <span className="dashboard-kpi-skeleton" /> : indicator.band}
      </div>
      <div className="une-card-body">
        <div className="une-card-label">{label}</div>
        <div className="une-card-percent" aria-label={`${indicator.percent}%`}>
          {loading ? '—' : `${indicator.percent}%`}
        </div>
        <div className="une-card-description">{description}</div>
      </div>
    </article>
  );
}

/**
 * StatusKpisWidget — 6 cards KPI clicables que navegan al listado
 * con filtro aplicado (decisión 1-C)
 *
 * Reutiliza el estilo del listado A para consistencia visual.
 */

import type { DashboardOverview } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.statusKpis;

export interface StatusKpisWidgetProps {
  overview: DashboardOverview;
  loading: boolean;
  onNavigate: (href: string) => void;
}

export default function StatusKpisWidget({ overview, loading, onNavigate }: StatusKpisWidgetProps) {
  return (
    <section className="dashboard-widget dashboard-widget-status-kpis">
      <h2 className="dashboard-widget-title">{COPY.title}</h2>
      <div className="dashboard-kpis-grid">
        <KpiCard
          label={COPY.total}
          value={overview.total}
          variant="total"
          loading={loading}
          onClick={() => onNavigate('/resources')}
        />
        <KpiCard
          label={COPY.published}
          value={overview.published}
          variant="published"
          loading={loading}
          onClick={() => onNavigate('/resources?status=published')}
        />
        <KpiCard
          label={COPY.scheduled}
          value={overview.scheduled}
          variant="scheduled"
          loading={loading}
          pulse={overview.scheduled > 0}
          onClick={() => onNavigate('/resources?status=scheduled')}
        />
        <KpiCard
          label={COPY.draft}
          value={overview.draft}
          variant="draft"
          loading={loading}
          onClick={() => onNavigate('/resources?status=draft')}
        />
        <KpiCard
          label={COPY.archived}
          value={overview.archived}
          variant="archived"
          loading={loading}
          onClick={() => onNavigate('/resources?status=archived')}
        />
        <KpiCard
          label={COPY.incompleteForPublish}
          value={overview.incompleteForPublish}
          variant="incomplete"
          loading={loading}
          highlight={overview.incompleteForPublish > 0}
          onClick={() => onNavigate('/resources?incomplete=1')}
        />
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  variant,
  loading,
  pulse = false,
  highlight = false,
  onClick,
}: {
  label: string;
  value: number;
  variant: 'total' | 'published' | 'scheduled' | 'draft' | 'archived' | 'incomplete';
  loading: boolean;
  pulse?: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`dashboard-kpi dashboard-kpi-${variant} ${highlight ? 'dashboard-kpi-highlight' : ''}`}
      onClick={onClick}
      aria-label={`${label}: ${value}. Click para filtrar el listado.`}
    >
      <div className="dashboard-kpi-value">
        {loading ? <span className="dashboard-kpi-skeleton" /> : value}
        {pulse && <span className="dashboard-kpi-pulse" aria-hidden />}
      </div>
      <div className="dashboard-kpi-label">{label}</div>
    </button>
  );
}

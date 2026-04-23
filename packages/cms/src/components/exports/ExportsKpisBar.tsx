/**
 * ExportsKpisBar — cabecera con 6 cards KPI del centro de exportaciones
 */

import type { ExportsKpis } from '@osalnes/shared/data/exports';
import { JOB_TYPE_SHORT_LABELS, formatDuration } from '@osalnes/shared/data/exports';
import { EXPORTS_COPY } from '../../pages/exports.copy';

const COPY = EXPORTS_COPY.kpis;

export interface ExportsKpisBarProps {
  kpis: ExportsKpis;
  loading: boolean;
}

export default function ExportsKpisBar({ kpis, loading }: ExportsKpisBarProps) {
  return (
    <section className="exports-kpis-grid" aria-label="Métricas de exportaciones">
      <KpiCard
        icon="📊"
        label={COPY.totalJobs}
        value={kpis.totalJobs}
        loading={loading}
        variant="neutral"
      />
      <KpiCard
        icon="✓"
        label={COPY.success24h}
        value={kpis.success24h}
        loading={loading}
        variant="success"
      />
      <KpiCard
        icon="✗"
        label={COPY.failed24h}
        value={kpis.failed24h}
        loading={loading}
        variant={kpis.failed24h > 0 ? 'danger' : 'neutral'}
      />
      <KpiCard
        icon="⏳"
        label={COPY.pending}
        value={kpis.pendingNow}
        loading={loading}
        variant={kpis.pendingNow > 0 ? 'info' : 'neutral'}
        pulse={kpis.pendingNow > 0}
      />
      <KpiCard
        icon="⚙️"
        label={COPY.running}
        value={kpis.runningNow}
        loading={loading}
        variant={kpis.runningNow > 0 ? 'warning' : 'neutral'}
        pulse={kpis.runningNow > 0}
      />
      <KpiCard
        icon="⏱"
        label={COPY.avgDuration}
        value={formatDuration(kpis.avgDurationMs)}
        loading={loading}
        variant="neutral"
        isText
      />
    </section>
  );
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: number | string;
  loading: boolean;
  variant: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  pulse?: boolean;
  isText?: boolean;
}

function KpiCard({
  icon,
  label,
  value,
  loading,
  variant,
  pulse = false,
  isText = false,
}: KpiCardProps) {
  return (
    <div className={`exports-kpi exports-kpi-${variant}`}>
      <span className="exports-kpi-icon" aria-hidden>{icon}</span>
      <div className="exports-kpi-body">
        <div className={`exports-kpi-value ${isText ? 'is-text' : ''}`}>
          {loading ? <span className="exports-kpi-skeleton" /> : value}
          {pulse && <span className="exports-kpi-pulse" aria-hidden />}
        </div>
        <div className="exports-kpi-label">{label}</div>
      </div>
    </div>
  );
}

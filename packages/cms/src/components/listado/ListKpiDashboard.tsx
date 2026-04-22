/**
 * ListKpiDashboard — 6 cards con métricas arriba del listado
 *
 * Decisión 7-A del usuario: KPIs total/publicados/programados/borradores/archivados/incompletos.
 *
 * Cada card es clicable y aplica un filtro rápido en el listado.
 */

import type { ListKpis, ListFilters } from '@osalnes/shared/data/resources-list';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.kpis;

export interface ListKpiDashboardProps {
  kpis: ListKpis;
  loading: boolean;
  /** Aplicar filtro al pulsar card. El padre decide qué hacer. */
  onApplyFilter: (patch: Partial<ListFilters>) => void;
}

export default function ListKpiDashboard({ kpis, loading, onApplyFilter }: ListKpiDashboardProps) {
  return (
    <section className="list-kpis" aria-label="Métricas del listado">
      <KpiCard
        label={COPY.total}
        value={kpis.total}
        variant="total"
        loading={loading}
        onClick={() => onApplyFilter({ status: 'all' })}
      />
      <KpiCard
        label={COPY.published}
        value={kpis.published}
        variant="published"
        loading={loading}
        onClick={() => onApplyFilter({ status: 'publicado' })}
      />
      <KpiCard
        label={COPY.scheduled}
        value={kpis.scheduled}
        variant="scheduled"
        loading={loading}
        pulse={kpis.scheduled > 0}
        onClick={() => onApplyFilter({ status: 'programado' })}
      />
      <KpiCard
        label={COPY.draft}
        value={kpis.draft}
        variant="draft"
        loading={loading}
        onClick={() => onApplyFilter({ status: 'borrador' })}
      />
      <KpiCard
        label={COPY.archived}
        value={kpis.archived}
        variant="archived"
        loading={loading}
        onClick={() => onApplyFilter({ status: 'archivado' })}
      />
      <KpiCard
        label={COPY.incompleteForPublish}
        value={kpis.incompleteForPublish}
        variant="incomplete"
        loading={loading}
        highlight={kpis.incompleteForPublish > 0}
        onClick={() =>
          onApplyFilter({ incompleteForPublish: true, status: 'all' })
        }
      />
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
      className={`list-kpi list-kpi-${variant} ${highlight ? 'list-kpi-highlight' : ''}`}
      onClick={onClick}
      aria-label={`${label}: ${value}. Click para filtrar.`}
    >
      <div className="list-kpi-value">
        {loading ? <span className="list-kpi-skeleton" /> : value}
        {pulse && <span className="list-kpi-pulse" aria-hidden />}
      </div>
      <div className="list-kpi-label">{label}</div>
    </button>
  );
}

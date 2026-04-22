/**
 * CatalogContextWidget — conteos de municipios y categorías del destino
 *
 * Heredado del dashboard actual. Contextualiza el destino: "11
 * municipios, 17 categorías". Útil para evaluadores del pliego que
 * quieren ver el alcance geográfico y semántico.
 */

import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.catalogContext;

export interface CatalogContextWidgetProps {
  municipalitiesCount: number;
  categoriesCount: number;
  loading: boolean;
}

export default function CatalogContextWidget({
  municipalitiesCount,
  categoriesCount,
  loading,
}: CatalogContextWidgetProps) {
  return (
    <section className="dashboard-widget dashboard-widget-catalog-context">
      <h2 className="dashboard-widget-title">{COPY.title}</h2>
      <div className="catalog-context-grid">
        <ContextCard
          icon="📍"
          label={COPY.municipalities}
          value={municipalitiesCount}
          loading={loading}
        />
        <ContextCard
          icon="🏷"
          label={COPY.categories}
          value={categoriesCount}
          loading={loading}
        />
      </div>
    </section>
  );
}

function ContextCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: string;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="catalog-context-card">
      <div className="catalog-context-icon" aria-hidden>{icon}</div>
      <div className="catalog-context-body">
        <div className="catalog-context-value">
          {loading ? <span className="dashboard-kpi-skeleton" /> : value}
        </div>
        <div className="catalog-context-label">{label}</div>
      </div>
    </div>
  );
}

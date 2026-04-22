/**
 * DashboardPage — orquestador del dashboard operativo (SCR-02)
 *
 * Monta todos los widgets respetando la visibilidad por rol.
 * Recibe el estado completo del hook useDashboard y callbacks para
 * navegación y acciones.
 */

import { canSeeWidget, type UserRole } from '@osalnes/shared/data/rbac';
import { formatRelativePast } from '@osalnes/shared/data/dashboard';
import type { UseDashboardState } from '../hooks/useDashboard';
import DashboardAlerts from '../components/dashboard/DashboardAlerts';
import QuickActionsWidget from '../components/dashboard/QuickActionsWidget';
import MyWorkWidget from '../components/dashboard/MyWorkWidget';
import StatusKpisWidget from '../components/dashboard/StatusKpisWidget';
import UpcomingScheduledWidget from '../components/dashboard/UpcomingScheduledWidget';
import UneIndicatorsWidget from '../components/dashboard/UneIndicatorsWidget';
import TranslationProgressWidget from '../components/dashboard/TranslationProgressWidget';
import DataQualityWidget from '../components/dashboard/DataQualityWidget';
import CatalogContextWidget from '../components/dashboard/CatalogContextWidget';
import LastExportWidget from '../components/dashboard/LastExportWidget';
import RecentActivityWidget from '../components/dashboard/RecentActivityWidget';
import { DASHBOARD_COPY } from './dashboard.copy';

export interface DashboardPageProps {
  state: UseDashboardState;
  role: UserRole;

  /** Conteo de municipios y categorías del catálogo */
  municipalitiesCount: number;
  categoriesCount: number;

  /** Resolver label legible de tipología */
  resolveTypologyLabel: (key: string | null) => string;

  /** Callbacks de navegación */
  onNavigate: (href: string) => void;
  onOpenResource: (id: string) => void;
  onCancelSchedule: (id: string) => Promise<void>;
}

export default function DashboardPage({
  state,
  role,
  municipalitiesCount,
  categoriesCount,
  resolveTypologyLabel,
  onNavigate,
  onOpenResource,
  onCancelSchedule,
}: DashboardPageProps) {
  const show = (id: Parameters<typeof canSeeWidget>[1]) => canSeeWidget(role, id);

  return (
    <div className="dashboard-page">
      <header className="dashboard-page-header">
        <div>
          <h1>{DASHBOARD_COPY.header.title}</h1>
          <p className="muted">{DASHBOARD_COPY.header.subtitle}</p>
        </div>
        <div className="dashboard-page-header-actions">
          {state.lastRefreshedAt && (
            <span
              className="dashboard-refresh-label muted"
              title={DASHBOARD_COPY.header.autoRefreshHint}
            >
              {DASHBOARD_COPY.header.lastRefreshedLabel.replace(
                '{when}',
                formatRelativePast(state.lastRefreshedAt.toISOString()),
              )}
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void state.refetch()}
            disabled={state.loading}
            aria-label={DASHBOARD_COPY.header.refreshButton}
          >
            {state.loading ? '⏳' : '↻'} {DASHBOARD_COPY.header.refreshButton}
          </button>
        </div>
      </header>

      {/* Error global */}
      {state.error && (
        <div className="dashboard-global-error" role="alert">
          ⚠️ {DASHBOARD_COPY.common.error}: {state.error}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void state.refetch()}
          >
            {DASHBOARD_COPY.common.retry}
          </button>
        </div>
      )}

      {/* Alertas inline */}
      {show('alerts') && (
        <DashboardAlerts overview={state.overview} onNavigate={onNavigate} />
      )}

      {/* FILA 1: Accesos rápidos + Mi trabajo */}
      <div className="dashboard-row dashboard-row-two">
        {show('quickActions') && (
          <QuickActionsWidget role={role} onNavigate={onNavigate} />
        )}
        {show('myWork') && (
          <MyWorkWidget
            rows={state.myWork}
            loading={state.initialLoading}
            onOpenResource={onOpenResource}
            onNavigate={onNavigate}
            resolveTypologyLabel={resolveTypologyLabel}
          />
        )}
      </div>

      {/* FILA 2: KPIs de estado */}
      {show('statusKpis') && (
        <StatusKpisWidget
          overview={state.overview}
          loading={state.initialLoading}
          onNavigate={onNavigate}
        />
      )}

      {/* FILA 3: Próximas publicaciones programadas */}
      {show('upcomingScheduled') && state.upcomingScheduled.length > 0 && (
        <UpcomingScheduledWidget
          rows={state.upcomingScheduled}
          loading={state.initialLoading}
          onOpenResource={onOpenResource}
          onCancelSchedule={onCancelSchedule}
          onNavigate={onNavigate}
          resolveTypologyLabel={resolveTypologyLabel}
        />
      )}

      {/* FILA 4: Indicadores UNE 178502 */}
      {show('uneIndicators') && (
        <UneIndicatorsWidget
          indicators={state.uneIndicators}
          loading={state.initialLoading}
        />
      )}

      {/* FILA 5: Calidad + Traducciones */}
      <div className="dashboard-row dashboard-row-two">
        {show('dataQuality') && (
          <DataQualityWidget
            overview={state.overview}
            loading={state.initialLoading}
            onNavigate={onNavigate}
          />
        )}
        {show('translationProgress') && (
          <TranslationProgressWidget
            rows={state.translationProgress}
            loading={state.initialLoading}
            onNavigate={onNavigate}
          />
        )}
      </div>

      {/* FILA 6: Contexto del catálogo */}
      {show('catalogContext') && (
        <CatalogContextWidget
          municipalitiesCount={municipalitiesCount}
          categoriesCount={categoriesCount}
          loading={state.initialLoading}
        />
      )}

      {/* FILA 7: Última exportación + Actividad reciente */}
      <div className="dashboard-row dashboard-row-two">
        {show('lastExport') && (
          <LastExportWidget
            overview={state.overview}
            onNavigate={onNavigate}
          />
        )}
        {show('recentActivity') && (
          <RecentActivityWidget
            rows={state.recentActivity}
            loading={state.initialLoading}
            onOpenResource={onOpenResource}
          />
        )}
      </div>
    </div>
  );
}

/**
 * DashboardAlerts — banner de alertas accionables
 *
 * Solo aparece si hay algo urgente/accionable. Cada alerta tiene un CTA
 * que navega al listado con los filtros correctos aplicados.
 *
 * Reglas:
 *   - Mostrar máximo 2 alertas a la vez (las más críticas).
 *   - Severity: danger (incompletos, sin coords), warning (sin imagen,
 *     sin export PID).
 *   - Si todo está limpio → no renderizar nada.
 */

import type { DashboardOverview } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY, pluralize } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.alerts;

type AlertSeverity = 'danger' | 'warning' | 'info';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  icon: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  /** Prioridad: más alto = más crítico */
  priority: number;
}

export interface DashboardAlertsProps {
  overview: DashboardOverview;
  onNavigate: (href: string) => void;
}

export default function DashboardAlerts({ overview, onNavigate }: DashboardAlertsProps) {
  const alerts: AlertItem[] = [];

  // Incompletos para publicar — crítico
  if (overview.incompleteForPublish > 0) {
    alerts.push({
      id: 'incomplete',
      severity: 'danger',
      icon: '⚠️',
      message: COPY.incompleteForPublish
        .replace('{count}', String(overview.incompleteForPublish))
        .replace('{recurso}', pluralize(overview.incompleteForPublish, 'recurso', 'recursos')),
      actionLabel: COPY.incompleteForPublishAction,
      actionHref: '/resources?incomplete=1',
      priority: 10,
    });
  }

  // Visibles en mapa sin coordenadas — crítico (rompe el mapa público)
  if (overview.withoutCoordinates > 0) {
    alerts.push({
      id: 'coords',
      severity: 'danger',
      icon: '📍',
      message: COPY.withoutCoordinates
        .replace('{count}', String(overview.withoutCoordinates))
        .replace('{recurso}', pluralize(overview.withoutCoordinates, 'recurso', 'recursos'))
        .replace('{visible}', pluralize(overview.withoutCoordinates, 'visible', 'visibles')),
      actionLabel: COPY.withoutCoordinatesAction,
      actionHref: '/resources?map=1&coords=0',
      priority: 9,
    });
  }

  // Sin imagen — warning
  if (overview.withoutImage > 0) {
    alerts.push({
      id: 'image',
      severity: 'warning',
      icon: '🖼',
      message: COPY.withoutImage
        .replace('{count}', String(overview.withoutImage))
        .replace('{recurso}', pluralize(overview.withoutImage, 'recurso', 'recursos')),
      actionLabel: COPY.withoutImageAction,
      actionHref: '/resources',
      priority: 5,
    });
  }

  // PID nunca exportado — info
  if (overview.lastExportAt == null && overview.published > 0) {
    alerts.push({
      id: 'pid',
      severity: 'info',
      icon: '📤',
      message: COPY.pidNotExported,
      actionLabel: COPY.pidNotExportedAction,
      actionHref: '/exports',
      priority: 3,
    });
  }

  // Mostrar solo las 2 más críticas
  const top = alerts.sort((a, b) => b.priority - a.priority).slice(0, 2);

  if (top.length === 0) return null;

  return (
    <section className="dashboard-alerts" aria-label="Alertas del sistema">
      {top.map((alert) => (
        <div
          key={alert.id}
          className={`dashboard-alert dashboard-alert-${alert.severity}`}
          role="alert"
        >
          <span className="dashboard-alert-icon" aria-hidden>{alert.icon}</span>
          <span className="dashboard-alert-message">{alert.message}</span>
          <button
            type="button"
            className="dashboard-alert-action"
            onClick={() => onNavigate(alert.actionHref)}
          >
            {alert.actionLabel} →
          </button>
        </div>
      ))}
    </section>
  );
}

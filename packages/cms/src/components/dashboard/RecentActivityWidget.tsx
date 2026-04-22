/**
 * RecentActivityWidget — últimas acciones en el sistema
 *
 * Arregla el bug del dashboard actual donde salía "modificar recurso.
 * Sep_cambios" formateado mal. Ahora usa iconos por acción y texto
 * legible.
 */

import type { ActivityRow } from '@osalnes/shared/data/dashboard';
import { formatRelativePast } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.recentActivity;

export interface RecentActivityWidgetProps {
  rows: ActivityRow[];
  loading: boolean;
  onOpenResource: (id: string) => void;
}

export default function RecentActivityWidget({
  rows,
  loading,
  onOpenResource,
}: RecentActivityWidgetProps) {
  return (
    <section className="dashboard-widget dashboard-widget-activity">
      <h2 className="dashboard-widget-title">{COPY.title}</h2>

      {loading && rows.length === 0 ? (
        <div className="dashboard-widget-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-skeleton-row">
              <div className="dashboard-skeleton-bar" style={{ width: '75%' }} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="dashboard-widget-empty">
          <p className="muted">{COPY.emptyHint}</p>
        </div>
      ) : (
        <ul className="activity-list" role="list">
          {rows.map((row, i) => (
            <li key={`${row.entityId}-${row.createdAt}-${i}`} className="activity-item">
              <span
                className={`activity-icon activity-icon-${normalizeAction(row.action)}`}
                aria-hidden
              >
                {iconForAction(row.action)}
              </span>
              <div className="activity-body">
                <div className="activity-text">
                  {row.actorEmail && (
                    <span className="activity-actor">{shortenEmail(row.actorEmail)}</span>
                  )}
                  <span className="muted"> {labelForAction(row.action)} </span>
                  <button
                    type="button"
                    className="activity-entity-link"
                    onClick={() => onOpenResource(row.entityId)}
                  >
                    {row.entityName}
                  </button>
                  {row.fieldName && (
                    <span className="activity-field muted">
                      {' '}· campo <code>{row.fieldName}</code>
                    </span>
                  )}
                </div>
                <div className="activity-when muted">
                  {formatRelativePast(row.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function normalizeAction(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('cre')) return 'created';
  if (a.includes('pub')) return 'published';
  if (a.includes('arch')) return 'archived';
  if (a.includes('elim') || a.includes('del')) return 'deleted';
  return 'updated';
}

function iconForAction(action: string): string {
  const normalized = normalizeAction(action);
  switch (normalized) {
    case 'created': return '✨';
    case 'published': return '🚀';
    case 'archived': return '🗄';
    case 'deleted': return '🗑';
    case 'updated': default: return '✏️';
  }
}

function labelForAction(action: string): string {
  const normalized = normalizeAction(action);
  return COPY.actionLabels[normalized] ?? 'actualizó';
}

function shortenEmail(email: string): string {
  // Muestra solo el local-part si es corto, o primera letra + domain si es largo
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 16) return local;
  return `${local.slice(0, 10)}…@${domain}`;
}
